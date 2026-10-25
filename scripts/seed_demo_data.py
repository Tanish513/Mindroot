import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://localhost:3000'

def request(path, method='GET', data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        # print(f"HTTPError on {path}: {e.code} - {err_msg}")
        try:
            return json.loads(err_msg)
        except:
            return {'error': err_msg, 'status': e.code}

print("1. Logging in as Admin...")
admin_res = request('/api/auth/login', 'POST', {'email': 'admin@mindroot.com', 'password': 'admin123'})
admin_token = admin_res.get('token')
print("Admin Token acquired:", bool(admin_token))

# Realistic student demo profiles (made-up names, @mindroot.edu emails, no real personal data)
students = [
    {
        'name': 'Alex Morgan',
        'email': 'alex.morgan@mindroot.edu',
        'password': 'Password123!',
        'role': 'both',
        'headline': 'Full-Stack Developer & Peer Mentor | React & TypeScript Enthusiast',
        'bio': 'Computer Science senior passionate about modern web engineering, real-time architectures, and clean code. Taught 45+ peer sessions.',
        'hourlyRate': 450,
        'tokenBalance': 14,
        'trustScore': 4.96,
        'skillsTaught': ['React & TypeScript', 'Next.js', 'State Management (Zustand)', 'WebRTC Basics'],
        'skillsLearned': ['Machine Learning', 'Python FastAPI', 'Docker Containers'],
        'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'alex.morgan@oksbi'
    },
    {
        'name': 'Sarah Chen',
        'email': 'sarah.chen@mindroot.edu',
        'password': 'Password123!',
        'role': 'teacher',
        'headline': 'Competitive Programmer & Algorithms Mentor | Ex-Google Intern',
        'bio': 'Specializing in Dynamic Programming, Graph Theory, and LeetCode optimization. Helping peers crack technical coding interviews.',
        'hourlyRate': 599,
        'tokenBalance': 22,
        'trustScore': 5.00,
        'skillsTaught': ['Data Structures & Algorithms', 'C++ STL', 'System Design Fundamentals', 'Graph Algorithms'],
        'skillsLearned': ['UI/UX Interaction Design', 'Figma Prototyping'],
        'avatar': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'sarah.chen@okhdfc'
    },
    {
        'name': 'David Patel',
        'email': 'david.patel@mindroot.edu',
        'password': 'Password123!',
        'role': 'both',
        'headline': 'AI & Backend Systems Explorer | Python & FastAPI Practitioner',
        'bio': 'Working on applied LLMs, vector search, and scalable asynchronous backends. Always excited to trade AI insights for frontend skills.',
        'hourlyRate': 499,
        'tokenBalance': 11,
        'trustScore': 4.88,
        'skillsTaught': ['Python Asynchronous Programming', 'FastAPI & PyDantic', 'PostgreSQL Optimization', 'PyTorch Basics'],
        'skillsLearned': ['React Native', 'Tailwind CSS', 'GraphQL'],
        'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'david.patel@okicici'
    },
    {
        'name': 'Elena Rostova',
        'email': 'elena.rostova@mindroot.edu',
        'password': 'Password123!',
        'role': 'teacher',
        'headline': 'Product Designer & UI/UX Specialist | Human-Centered Design',
        'bio': 'Design systems architect focused on accessible interfaces, motion design, and developer-designer handoffs.',
        'hourlyRate': 400,
        'tokenBalance': 16,
        'trustScore': 4.92,
        'skillsTaught': ['Figma Design Systems', 'UI/UX Design', 'Tailwind CSS', 'Mobile App Interfaces'],
        'skillsLearned': ['Node.js APIs', 'Database Schema Modeling'],
        'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'elena.rostova@paytm'
    },
    {
        'name': 'Marcus Thorne',
        'email': 'marcus.thorne@mindroot.edu',
        'password': 'Password123!',
        'role': 'student',
        'headline': 'Junior Developer & Open Source Contributor',
        'bio': 'Second-year software engineering student actively building web apps and learning frontend engineering.',
        'hourlyRate': 0,
        'tokenBalance': 8,
        'trustScore': 4.75,
        'skillsTaught': ['Git & GitHub Workflows', 'Linux Command Line', 'Markdown'],
        'skillsLearned': ['React & TypeScript', 'Full-Stack JavaScript', 'REST APIs'],
        'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'marcus.thorne@axisbank'
    },
    {
        'name': 'Priya Sharma',
        'email': 'priya.sharma@mindroot.edu',
        'password': 'Password123!',
        'role': 'both',
        'headline': 'Database Architect & Cloud Practitioner | PostgreSQL & AWS',
        'bio': 'Database administrator in training. Love indexing, query plan analysis, and database migrations with Prisma and SQL.',
        'hourlyRate': 350,
        'tokenBalance': 15,
        'trustScore': 4.90,
        'skillsTaught': ['SQL Query Tuning', 'PostgreSQL Internals', 'Database Schema Design', 'Prisma ORM'],
        'skillsLearned': ['Cloud Kubernetes', 'Golang Fundamentals'],
        'avatar': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'priya.sharma@sbi'
    },
    {
        'name': 'Liam O\'Connor',
        'email': 'liam.oconnor@mindroot.edu',
        'password': 'Password123!',
        'role': 'student',
        'headline': 'CS Sophomore | Passionate about Distributed Systems & Networking',
        'bio': 'Keen to master peer-to-peer protocols, WebSockets, and real-time audio/video streaming via WebRTC.',
        'hourlyRate': 0,
        'tokenBalance': 6,
        'trustScore': 4.80,
        'skillsTaught': ['Java OOP', 'Unit Testing with JUnit', 'Basic Data Structures'],
        'skillsLearned': ['WebRTC Audio/Video', 'Socket.io Signaling', 'Express.js Backend'],
        'avatar': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'liam.oconnor@icici'
    },
    {
        'name': 'Maya Lin',
        'email': 'maya.lin@mindroot.edu',
        'password': 'Password123!',
        'role': 'teacher',
        'headline': 'DevOps & Cloud Engineer | Kubernetes & CI/CD Specialist',
        'bio': 'Guiding students on infrastructure automation, Dockerizing full-stack microservices, and setting up automated GitHub Action pipelines.',
        'hourlyRate': 550,
        'tokenBalance': 20,
        'trustScore': 4.98,
        'skillsTaught': ['Docker Containerization', 'Kubernetes Clusters', 'CI/CD Pipelines', 'Cloud Security'],
        'skillsLearned': ['Rust Programming', 'WebAssembly'],
        'avatar': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&h=256&q=80',
        'upiId': 'maya.lin@kotak'
    }
]

created_users = {}

print("2. Registering and configuring demo student profiles...")
for s in students:
    # 1. Register or login
    reg_data = {
        'name': s['name'],
        'email': s['email'],
        'password': s['password'],
        'role': s['role'],
        'teaches': s['skillsTaught'],
        'learns': s['skillsLearned']
    }
    reg_res = request('/api/auth/register', 'POST', reg_data)
    user_id = reg_res.get('user', {}).get('id')
    user_token = reg_res.get('token')
    
    if not user_token:
        # User may already exist, login
        login_res = request('/api/auth/login', 'POST', {'email': s['email'], 'password': s['password']})
        user_id = login_res.get('user', {}).get('id')
        user_token = login_res.get('token')
    
    if user_id and admin_token:
        # Update user with rich attributes via Admin PATCH
        update_data = {
            'name': s['name'],
            'bio': s['bio'],
            'role': s['role'],
            'hourlyRate': s['hourlyRate'],
            'avatar': s['avatar'],
            'tokenBalance': s['tokenBalance'],
            'trustScore': s['trustScore'],
            'skillsTaught': s['skillsTaught'],
            'skillsLearned': s['skillsLearned'],
            'upiId': s['upiId'],
            'isPublic': True
        }
        patch_res = request(f"/api/users/{user_id}", 'PATCH', update_data, token=admin_token)
        created_users[s['name']] = {'id': user_id, 'token': user_token, 'data': s}
        print(f"  ✓ Seeded {s['name']} (ID: {user_id[:8]}..., Tokens: {s['tokenBalance']}, Role: {s['role']})")

print(f"Total students configured: {len(created_users)}")

# Create realistic sessions
print("3. Creating realistic peer exchange sessions...")
alex = created_users.get('Alex Morgan')
sarah = created_users.get('Sarah Chen')
david = created_users.get('David Patel')
elena = created_users.get('Elena Rostova')
marcus = created_users.get('Marcus Thorne')
priya = created_users.get('Priya Sharma')
maya = created_users.get('Maya Lin')

sessions_to_create = [
    {
        'student': alex,
        'teacher': sarah,
        'title': 'Advanced Binary Trees & Dynamic Programming',
        'status': 'confirmed',
        'durationMin': 60,
        'isSwap': True,
        'payWithTokens': True
    },
    {
        'student': alex,
        'teacher': david,
        'title': 'Python AsyncIO & FastAPI REST Architecture',
        'status': 'completed',
        'durationMin': 60,
        'isSwap': True,
        'payWithTokens': True
    },
    {
        'student': marcus,
        'teacher': elena,
        'title': 'Figma Design Systems & Responsive Layouts',
        'status': 'pending',
        'durationMin': 60,
        'isSwap': True,
        'payWithTokens': True
    },
    {
        'student': priya,
        'teacher': maya,
        'title': 'Docker Containerization & Kubernetes Deployments',
        'status': 'confirmed',
        'durationMin': 60,
        'isSwap': True,
        'payWithTokens': True
    }
]

created_sessions = []
for sess_spec in sessions_to_create:
    st = sess_spec['student']
    tc = sess_spec['teacher']
    if not st or not tc:
        continue
    
    booking_payload = {
        'teacherId': tc['id'],
        'title': sess_spec['title'],
        'scheduledAt': time.strftime("%Y-%m-%dT16:00:00.000Z"),
        'durationMin': sess_spec['durationMin'],
        'isSwap': sess_spec['isSwap'],
        'payWithTokens': sess_spec['payWithTokens']
    }
    
    sess_res = request('/api/sessions', 'POST', booking_payload, token=st['token'])
    sess_id = sess_res.get('session', {}).get('id') or sess_res.get('id')
    
    if sess_id:
        target_status = sess_spec['status']
        if target_status in ['confirmed', 'completed']:
            # Teacher confirms
            request(f"/api/sessions/{sess_id}", 'PATCH', {'status': 'confirmed'}, token=tc['token'])
            if target_status == 'completed':
                # Complete session
                request(f"/api/sessions/{sess_id}", 'PATCH', {'status': 'completed'}, token=tc['token'])
        print(f"  ✓ Created Session: '{sess_spec['title']}' -> Status: {target_status}")
        created_sessions.append({'id': sess_id, 'title': sess_spec['title'], 'status': target_status})

print("Demo data seeding completed successfully!")
