from jose import jwt
import urllib.request
import os
os.environ['JWT_SECRET'] = 'super-secret-lyg-token-998877'
token = jwt.encode({"sub": "guillermo.diarte@gmail.com", "role": "admin"}, "super-secret-lyg-token-998877", algorithm="HS256")
req = urllib.request.Request("http://localhost:8001/api/admin/backup/db")
req.add_header("X-API-KEY", token)
try:
    res = urllib.request.urlopen(req)
    print("SUCCESS DB:", res.status)
except Exception as e:
    print("ERROR DB:", e)
    if hasattr(e, 'read'): print(e.read())

req2 = urllib.request.Request("http://localhost:8001/api/admin/backup/images")
req2.add_header("X-API-KEY", token)
try:
    res2 = urllib.request.urlopen(req2)
    print("SUCCESS IMG:", res2.status)
except Exception as e:
    print("ERROR IMG:", e)
    if hasattr(e, 'read'): print(e.read())
