import unittest
from unittest.mock import patch
import threading
import urllib.request
import urllib.error
import json
import server
import behance
from unittest.mock import MagicMock

class BehancePreview(unittest.TestCase):
    def test_public_project_validation(self):
        behance.validate('https://www.behance.net/gallery/123/Project')
        for url in ('https://www.behance.net/login','http://www.behance.net/gallery/123','https://www.behance.net.evil.test/gallery/123','https://user:pass@www.behance.net/gallery/123'):
            with self.subTest(url=url),self.assertRaises(ValueError):behance.validate(url)

    def test_literal_anonymous_confirmation_once(self):
        def response(code,body):
            r=MagicMock();r.status=code;r.read.return_value=body;r.headers={'Content-Type':'text/html'};r.url='https://www.behance.net/gallery/123/Project';r.__enter__.return_value=r
            return r
        opener=MagicMock();opener.open.side_effect=[response(403,b'document.cookie = "js_challenge_value=abcdef123456; Path=/"'),response(200,b'<html><title>Project</title></html>')]
        with patch.object(behance,'build_opener',return_value=opener):
            body,_,_=behance.fetch('https://www.behance.net/gallery/123/Project',1024)
        self.assertIn(b'Project',body);self.assertEqual(opener.open.call_count,2)

    def test_captcha_and_login_are_not_retried(self):
        r=MagicMock();r.status=403;r.read.return_value=b'<html>Please log in or solve CAPTCHA</html>';r.__enter__.return_value=r
        opener=MagicMock();opener.open.return_value=r
        with patch.object(behance,'build_opener',return_value=opener):
            with self.assertRaises(ValueError):behance.fetch('https://www.behance.net/gallery/123/Project',1024)
        self.assertEqual(opener.open.call_count,1)

def answer(ip):
    return [(2, 1, 6, '', (ip, 443))]

class PublicTargets(unittest.TestCase):
    def test_private_and_reserved_addresses(self):
        for ip in ('127.0.0.1','10.1.2.3','192.168.1.1','169.254.169.254','0.0.0.0','198.18.0.1'):
            with self.subTest(ip=ip), patch.object(server.socket,'getaddrinfo',return_value=answer(ip)), patch.object(server,'local_proxy',return_value=None):
                with self.assertRaises(ValueError):server.public_target('https://public.example/')

    def test_mixed_dns_answer_is_rejected(self):
        with patch.object(server.socket,'getaddrinfo',return_value=answer('8.8.8.8')+answer('127.0.0.1')):
            with self.assertRaises(ValueError):server.public_target('https://public.example/')

    def test_public_dns_ip_is_returned_for_pinned_connection(self):
        with patch.object(server.socket,'getaddrinfo',return_value=answer('8.8.8.8')):
            self.assertEqual(server.public_target('https://public.example/')[3],['8.8.8.8'])

    def test_protocol_credentials_ports_and_hostnames(self):
        for url in ('file:///etc/passwd','https://u:p@example.com','https://example.com:22','http://localhost','http://abc.internal','http://example.com\\@127.0.0.1','http://example.com/\n'):
            with self.subTest(url=url), self.assertRaises(ValueError):server.public_target(url)

class Parsing(unittest.TestCase):
    def test_metadata_entities_and_relative_assets(self):
        html=b'<title>Fallback</title><meta property="og:title" content="Design &amp; tools"><meta name="description" content="Editable links"><meta property="og:image" content="/cover.png"><link rel="icon" href="/icon.png">'
        with patch.object(server,'download',return_value=(html,'text/html','https://example.com/article')):
            result=server.metadata('https://example.com/article')
        self.assertEqual(result['title'],'Design & tools')
        self.assertEqual(result['image']['url'],'https://example.com/cover.png')
        self.assertEqual(result['logo']['url'],'https://example.com/icon.png')

    def test_denied_html_is_not_successful_metadata(self):
        with patch.object(server,'download',return_value=(b'<title>Access Denied</title>','text/html','https://example.com')):
            with self.assertRaises(ValueError):server.metadata('https://example.com')

    def test_image_cannot_be_javascript_or_credential_url(self):
        html=b'<title>Title</title><meta property="og:image" content="javascript:alert(1)"><link rel="icon" href="https://u:p@example.com/icon.png">'
        with patch.object(server,'download',return_value=(html,'text/html','https://example.com')):
            result=server.metadata('https://example.com')
        self.assertEqual(result['image']['url'],'')
        self.assertEqual(result['logo']['url'],'')

class Protocol(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()

    def test_health_cors(self):
        with urllib.request.urlopen(self.base+'/health') as r:
            self.assertEqual(json.load(r)['service'],'linkmark')
            self.assertEqual(r.headers['Access-Control-Allow-Origin'],'*')

    def test_host_validation(self):
        req=urllib.request.Request(self.base+'/health',headers={'Host':'evil.example'})
        with self.assertRaises(urllib.error.HTTPError) as result:urllib.request.urlopen(req)
        self.assertEqual(result.exception.code,403)

    def test_metadata_protocol(self):
        with patch.object(server,'metadata',return_value={'title':'Test'}):
            with urllib.request.urlopen(self.base+'/metadata?url=https%3A%2F%2Fexample.com') as r:
                self.assertEqual(json.load(r)['data']['title'],'Test')

    def test_image_rejects_html(self):
        with patch.object(server,'download',return_value=(b'<html>','text/html','https://example.com')):
            with self.assertRaises(urllib.error.HTTPError) as result:urllib.request.urlopen(self.base+'/image?url=https%3A%2F%2Fexample.com')
            self.assertEqual(result.exception.code,422)

if __name__=='__main__':unittest.main(verbosity=2)
