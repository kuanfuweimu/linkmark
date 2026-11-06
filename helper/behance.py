"""Public Behance project previews using a fresh, anonymous visitor session."""
import http.cookiejar
import re
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler, Request
from urllib.error import HTTPError

CDN_HOST = 'mir-s3-cdn-cf.behance.net'

def validate(url, image=False):
    p = urlsplit(url)
    host = CDN_HOST if image else 'www.behance.net'
    if p.scheme != 'https' or p.hostname != host or p.username or p.password or p.port not in (None,443):
        raise ValueError('Unsupported Behance public URL')
    if not image and not re.match(r'^/gallery/\d+(?:/|$)',p.path):
        raise ValueError('Only public Behance project pages are supported')

def fetch(url, limit, image=False):
    validate(url,image)
    class SameHostRedirect(HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            validate(newurl,image)
            return super().redirect_request(req,fp,code,msg,headers,newurl)
    jar = http.cookiejar.CookieJar()
    opener = build_opener(HTTPCookieProcessor(jar),SameHostRedirect())
    for attempt in range(2):
        try:
            response=opener.open(Request(url,headers={'User-Agent':'Mozilla/5.0','Accept-Encoding':'identity','Accept':'image/*' if image else 'text/html'}),timeout=10)
        except HTTPError as error:
            response=error
        with response:
            raw=response.read(limit+1)
            if len(raw)>limit:raise ValueError('Behance response is too large')
            if response.status==200:
                return raw,response.headers.get('Content-Type',''),response.url
            html=raw.decode('utf-8','replace')
            marker=re.search(r'document\.cookie\s*=\s*"(js_challenge_value)=([a-fA-F0-9]{1,512});\s*Path=/"',html)
            if not image and attempt==0 and response.status==403 and marker:
                # Interpret one literal anonymous visitor marker. Never execute site JS,
                # import browser cookies, solve CAPTCHA, or continue past login walls.
                jar.set_cookie(http.cookiejar.Cookie(version=0,name=marker[1],value=marker[2],port=None,port_specified=False,domain='www.behance.net',domain_specified=False,domain_initial_dot=False,path='/',path_specified=True,secure=True,expires=None,discard=True,comment=None,comment_url=None,rest={}))
            else:
                raise ValueError('Behance returned HTTP '+str(response.status)+'; automatic public preview is unavailable')
    raise ValueError('Behance anonymous visitor confirmation did not complete')
