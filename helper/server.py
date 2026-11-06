"""Linkmark local public-link helper. No account cookies or disk uploads."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from html.parser import HTMLParser
from urllib.parse import urlsplit, urljoin, parse_qs, quote
import urllib.request
import http.client
import ipaddress
import socket
import ssl
import json
import threading
import argparse
import behance

PORT = 43187
LIMIT = 6 * 1024 * 1024
SLOTS = threading.BoundedSemaphore(4)

def local_proxy():
    value = urllib.request.getproxies().get('https', '')
    p = urlsplit(value)
    if p.scheme == 'http' and p.hostname in ('127.0.0.1', 'localhost') and not p.username:
        return p
    return None

def public_target(url):
    if len(url) > 4096 or any(ord(c) < 33 for c in url) or '\\' in url:
        raise ValueError('Invalid URL')
    p = urlsplit(url)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
        raise ValueError('Only public HTTP(S) URLs without credentials are supported')
    if p.port not in (None, 80, 443):
        raise ValueError('Only standard web ports are supported')
    host = p.hostname.encode('idna').decode('ascii')
    if host == 'localhost' or host.endswith(('.localhost', '.local', '.internal')):
        raise ValueError('Private hostnames are not allowed')
    port = p.port or (443 if p.scheme == 'https' else 80)
    addresses = list(dict.fromkeys(a[4][0] for a in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)))
    # Some Windows proxies replace public DNS answers with 198.18/15 Fake-IP.
    # Resolve those names through public DNS, then tunnel only to validated public IPs.
    fake = ipaddress.ip_network('198.18.0.0/15')
    if addresses and all(ipaddress.ip_address(a) in fake for a in addresses) and local_proxy():
        try:
            ipaddress.ip_address(host)
        except ValueError:
            req = urllib.request.Request('https://dns.alidns.com/resolve?name='+quote(host)+'&type=A', headers={'Accept':'application/dns-json'})
            with urllib.request.urlopen(req, timeout=6) as r:
                answer = json.load(r)
            addresses = [a['data'] for a in answer.get('Answer', []) if a.get('type') == 1]
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise ValueError('Private or reserved network addresses are not allowed')
    return p, host, port, addresses

def download(url, limit=LIMIT):
    p = urlsplit(url)
    if p.hostname == 'www.behance.net' and p.path.startswith('/gallery/'):
        return behance.fetch(url,limit)
    if p.hostname == behance.CDN_HOST:
        return behance.fetch(url,limit,image=True)
    for _ in range(5):
        p, host, port, addresses = public_target(url)
        # Connect to the validated IP, retaining the hostname for TLS validation.
        # This avoids a second DNS lookup and rejects private redirect destinations.
        proxy = local_proxy()
        if proxy:
            conn = http.client.HTTPConnection(proxy.hostname, proxy.port, timeout=8)
            conn.set_tunnel(addresses[0], port)
            conn.connect()
            sock = conn.sock
        else:
            conn = http.client.HTTPConnection(host, port, timeout=8)
            sock = socket.create_connection((addresses[0], port), timeout=8)
        if p.scheme == 'https':
            try:
                sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
            except Exception:
                sock.close()
                raise
        conn.sock = sock
        path = quote(p.path or '/', safe='/%:@!$&\'()*+,;=-._~')
        if p.query:
            path += '?' + quote(p.query, safe='/%?:@!$&\'()*+,;=-._~')
        try:
            conn.request('GET', path, headers={'Host': host, 'User-Agent': 'Mozilla/5.0 (compatible; Linkmark/0.2)', 'Accept-Encoding': 'identity', 'Accept': '*/*'})
            response = conn.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location:
                    raise ValueError('Redirect without destination')
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise ValueError('Website returned HTTP ' + str(response.status))
            declared = response.getheader('Content-Length')
            if declared and int(declared) > limit:
                raise ValueError('Response is too large')
            body = response.read(limit + 1)
            if len(body) > limit:
                raise ValueError('Response is too large')
            return body, response.getheader('Content-Type', ''), url
        finally:
            conn.close()
    raise ValueError('Too many redirects')

class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.title = ''
        self.in_title = False
        self.icon = ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            key = (a.get('property') or a.get('name') or '').lower()
            if key and a.get('content') and key not in self.meta:
                self.meta[key] = a['content']
        elif tag == 'title':
            self.in_title = True
        elif tag == 'link' and 'icon' in (a.get('rel') or '').lower().split() and not self.icon:
            self.icon = a.get('href') or ''

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data

def metadata(url):
    body, content_type, final_url = download(url, 2 * 1024 * 1024)
    if 'html' not in content_type.lower():
        raise ValueError('This URL does not return an HTML page')
    charset = 'utf-8'
    if 'charset=' in content_type:
        charset = content_type.split('charset=', 1)[1].split(';')[0].strip(' "\'')
    try:
        html = body.decode(charset, 'replace')
    except LookupError:
        html = body.decode('utf-8', 'replace')
    parser = MetadataParser()
    parser.feed(html)
    m = parser.meta
    title = (m.get('og:title') or m.get('twitter:title') or parser.title or urlsplit(url).hostname).strip()
    description = (m.get('og:description') or m.get('twitter:description') or m.get('description') or '').strip()
    if title.lower() in ('access denied', 'forbidden', 'just a moment...', 'attention required!'):
        raise ValueError('Website blocked automated preview access')
    def asset(value):
        candidate = urljoin(final_url, value) if value else ''
        p = urlsplit(candidate)
        return candidate if p.scheme in ('http','https') and not p.username and not p.password else ''
    return {'title':title[:240], 'description':description[:600], 'image':{'url':asset(m.get('og:image') or m.get('twitter:image') or '')}, 'logo':{'url':asset(parser.icon)}, 'provider':'local'}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Do not log users' URLs.

    def reply(self, code, body, content_type='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.reply(204, b'')

    def do_GET(self):
        if self.headers.get('Host') not in ('127.0.0.1:'+str(self.server.server_port), 'localhost:'+str(self.server.server_port)):
            self.reply(403, b'{"error":"Invalid host"}')
            return
        p = urlsplit(self.path)
        if p.path == '/health':
            self.reply(200, b'{"service":"linkmark","version":"0.2.0"}')
            return
        if p.path not in ('/metadata', '/image'):
            self.reply(404, b'{"error":"Not found"}')
            return
        if not SLOTS.acquire(blocking=False):
            self.reply(429, b'{"error":"Busy; retry shortly"}')
            return
        try:
            url = parse_qs(p.query).get('url', [''])[0]
            if p.path == '/metadata':
                self.reply(200, json.dumps({'status':'success','data':metadata(url)}).encode())
            else:
                body, mime, _ = download(url)
                mime = mime.split(';')[0].lower()
                if mime not in ('image/png', 'image/jpeg', 'image/webp'):
                    raise ValueError('Only PNG, JPEG and WebP covers are supported')
                self.reply(200, body, mime)
        except Exception as e:
            self.reply(422, json.dumps({'error':str(e)[:240]}).encode())
        finally:
            SLOTS.release()

if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--port', type=int, default=PORT)
    port = args.parse_args().port
    print(f'Linkmark helper: http://127.0.0.1:{port} (Ctrl+C to stop)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
