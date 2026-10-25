import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://localhost:3000'

def req(path, method='GET', data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as res:
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"Error on {path}: {e}")
        return {}

# 1. Login as Alex Morgan & Sarah Chen & David Patel
alex_login = req('/api/auth/login', 'POST', {'email': 'alex.morgan@mindroot.edu', 'password': 'Password123!'})
sarah_login = req('/api/auth/login', 'POST', {'email': 'sarah.chen@mindroot.edu', 'password': 'Password123!'})
david_login = req('/api/auth/login', 'POST', {'email': 'david.patel@mindroot.edu', 'password': 'Password123!'})
elena_login = req('/api/auth/login', 'POST', {'email': 'elena.rostova@mindroot.edu', 'password': 'Password123!'})
marcus_login = req('/api/auth/login', 'POST', {'email': 'marcus.thorne@mindroot.edu', 'password': 'Password123!'})

print("Alex ID:", alex_login.get('user', {}).get('id'))
print("Sarah ID:", sarah_login.get('user', {}).get('id'))

alex_id = alex_login.get('user', {}).get('id')
sarah_id = sarah_login.get('user', {}).get('id')
david_id = david_login.get('user', {}).get('id')
elena_id = elena_login.get('user', {}).get('id')
marcus_id = marcus_login.get('user', {}).get('id')

alex_tok = alex_login.get('token')
sarah_tok = sarah_login.get('token')
david_tok = david_login.get('token')
elena_tok = elena_login.get('token')
marcus_tok = marcus_login.get('token')

# Create Confirmed Live Session between Alex and Sarah
s1 = req('/api/sessions', 'POST', {
    'teacherId': sarah_id,
    'title': 'Advanced Binary Trees & Dynamic Programming',
    'scheduledAt': time.strftime("%Y-%m-%dT16:00:00.000Z"),
    'durationMin': 60,
    'payWithTokens': True,
    'isSwap': True
}, token=alex_tok)

s1_id = s1.get('session', {}).get('id') or s1.get('id')
print("Session 1 created:", s1_id)
if s1_id:
    # Sarah confirms
    c1 = req(f"/api/sessions/{s1_id}", 'PATCH', {'status': 'confirmed'}, token=sarah_tok)
    print("Session 1 confirmed:", c1.get('status') or 'ok')

# Create Completed Session between Alex and David
s2 = req('/api/sessions', 'POST', {
    'teacherId': david_id,
    'title': 'Python AsyncIO & FastAPI REST Architecture',
    'scheduledAt': time.strftime("%Y-%m-%dT14:00:00.000Z"),
    'durationMin': 60,
    'payWithTokens': True,
    'isSwap': True
}, token=alex_tok)

s2_id = s2.get('session', {}).get('id') or s2.get('id')
print("Session 2 created:", s2_id)
if s2_id:
    req(f"/api/sessions/{s2_id}", 'PATCH', {'status': 'confirmed'}, token=david_tok)
    req(f"/api/sessions/{s2_id}", 'PATCH', {'status': 'completed'}, token=david_tok)
    print("Session 2 completed")

# Create Pending Session between Marcus and Elena
s3 = req('/api/sessions', 'POST', {
    'teacherId': elena_id,
    'title': 'Figma Design Systems & Responsive Layouts',
    'scheduledAt': time.strftime("%Y-%m-%dT18:00:00.000Z"),
    'durationMin': 60,
    'payWithTokens': True,
    'isSwap': True
}, token=marcus_tok)

s3_id = s3.get('session', {}).get('id') or s3.get('id')
print("Session 3 pending created:", s3_id)

print("All demo sessions successfully populated!")
