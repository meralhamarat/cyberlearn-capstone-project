# Teacher & Class Management Implementation Guide

## Overview
Your EdTech platform now has a complete Teacher & Class Management system with:
- Admin can create teachers with unique teacher codes (e.g., `TCH-ABC123`)
- Admin assigns teachers to classrooms (many-to-many relationship)
- Students register using only their teacher code
- Automatic classroom assignment based on teacher's assignments

---

## Database Model Changes

### User Model Updates
```python
# NEW FIELDS:
is_active: Boolean = True  # Account status (can be deactivated by admin)
teacher_code: String(50), unique=True  # Generated when user becomes teacher
```

### Relationships (Already in place)
```
User.teacher_classrooms → TeacherClassroom (one-to-many)
  ├─ Teacher can manage multiple classrooms
  └─ Classroom can be managed by multiple teachers (co-teaching)

User.classroom → Classroom (many-to-one, for students)
  └─ Each student belongs to ONE classroom
```

---

## API Endpoints

### 1. TEACHER MANAGEMENT (Admin Only)

#### Create a Teacher
```http
POST /api/admin/teachers
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "optional_password_here"  # Auto-generated if omitted
}
```

**Response:**
```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "teacher_code": "TCH-ABC123",
  "generated_password": "auto_generated_if_not_provided",
  "message": "✓ Teacher 'John Doe' created successfully with code TCH-ABC123"
}
```

#### List All Teachers
```http
GET /api/admin/teachers
Authorization: Bearer {admin_token}
```

**Response:**
```json
[
  {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "teacher_code": "TCH-ABC123",
    "is_verified": true,
    "is_active": true,
    "created_at": "2024-06-15T10:30:00",
    "classrooms": [
      {
        "id": 1,
        "name": "Grade 10 Math",
        "code": "MATH-101"
      },
      {
        "id": 2,
        "name": "Advanced Algebra",
        "code": "MATH-201"
      }
    ]
  }
]
```

#### Get Teacher Details
```http
GET /api/admin/teachers/{teacher_id}
Authorization: Bearer {admin_token}
```

---

### 2. CLASSROOM MANAGEMENT (Admin Only)

#### Create a Classroom
```http
POST /api/admin/classrooms
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Grade 10 Mathematics",
  "code": "MATH-101"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Grade 10 Mathematics",
  "code": "MATH-101",
  "message": "✓ Classroom 'Grade 10 Mathematics' created with code MATH-101"
}
```

#### List All Classrooms
```http
GET /api/admin/classrooms
Authorization: Bearer {admin_token}
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Grade 10 Mathematics",
    "code": "MATH-101",
    "student_count": 25,
    "created_at": "2024-06-15T10:00:00",
    "teachers": [
      {
        "id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "teacher_code": "TCH-ABC123"
      }
    ]
  }
]
```

#### Assign Teacher to Classroom
```http
POST /api/admin/classrooms/{classroom_id}/assign-teacher
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "teacher_id": 1
}
```

**Response:**
```json
{
  "message": "✓ Teacher assigned to classroom",
  "teacher_id": 1,
  "classroom_id": 1,
  "teacher_name": "John Doe",
  "classroom_code": "MATH-101"
}
```

#### Remove Teacher from Classroom
```http
DELETE /api/admin/classrooms/{classroom_id}/teachers/{teacher_id}
Authorization: Bearer {admin_token}
```

---

### 3. STUDENT REGISTRATION WITH TEACHER CODE (Public)

#### Register Student Using Teacher Code
```http
POST /auth/register/teacher-code
Content-Type: application/json

{
  "first_name": "Ahmed",
  "last_name": "Ali",
  "email": "ahmed@example.com",
  "password": "SecurePassword123!",
  "teacher_code": "TCH-ABC123"
}
```

**Flow:**
1. System validates teacher code exists and is active ✓
2. System finds the first classroom assigned to that teacher ✓
3. Student automatically joins that classroom ✓
4. Email verification code is sent ✓

**Response:**
```json
{
  "id": 100,
  "email": "ahmed@example.com",
  "first_name": "Ahmed",
  "last_name": "Ali",
  "classroom_id": 1,
  "classroom_code": "MATH-101",
  "teacher_name": "John Doe",
  "message": "✓ Registration successful! Check your email for verification code.",
  "verification_code": "123456"
}
```

#### Verify Email
```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "123456"
}
```

**Response:**
```json
{
  "message": "✓ Email verified successfully! You can now log in.",
  "user_id": 100,
  "email": "ahmed@example.com"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 100,
    "first_name": "Ahmed",
    "last_name": "Ali",
    "email": "ahmed@example.com",
    "role": "student",
    "is_verified": true,
    "is_active": true,
    "elo_rating": 1000,
    "story_chapter": 1,
    "avatar": "warrior-1",
    "teacher_code": null,
    "classroom_id": 1
  }
}
```

---

### 4. USER MANAGEMENT (Admin Only)

#### Update User Status (Active/Inactive)
```http
PATCH /api/admin/users/{user_id}/status
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "is_active": false
}
```

#### Update User Role
```http
PATCH /api/admin/users/{user_id}/role
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "role": "teacher"  # student|teacher|admin
}
```

**Auto-behavior:**
- When promoting to teacher → Auto-generates unique teacher code
- When demoting from teacher → Clears teacher code

---

## Implementation Checklist

- [x] Add `is_active` field to User model with unique index on `teacher_code`
- [x] Create/update Pydantic schemas:
  - `TeacherCreate`, `TeacherCreateResponse`, `TeacherResponse`
  - `StudentRegisterWithTeacher`, `StudentRegisterWithTeacherResponse`
  - `AssignTeacherRequest`, `AssignTeacherResponse`
- [x] Update admin routes:
  - `POST /api/admin/teachers` → Create teacher with auto-generated code
  - `GET /api/admin/teachers` → List all teachers with classrooms
  - `POST /api/admin/classrooms/{id}/assign-teacher` → Assign teacher
- [x] Update auth routes:
  - `POST /auth/register/teacher-code` → New simplified student registration
- [x] Add `is_active` check in login endpoint
- [x] Add validation for teacher account status during registration

---

## Security Considerations

1. **Teacher Code Format:** `TCH-` prefix + 8 random alphanumeric chars
   - Prevents dictionary attacks
   - Case-insensitive comparison
   - Unique constraint at DB level

2. **Account Deactivation:** 
   - Deactivated users cannot login
   - Admin cannot deactivate their own account
   - Teachers and students can be deactivated independently

3. **Email Verification:**
   - Required before login
   - 15-minute expiration
   - One-time use tokens

4. **Password Security:**
   - Bcrypt hashing with 12 rounds
   - Passwords truncated to 72 chars (bcrypt limit)
   - Min 8 chars for student registration

---

## Example Workflow

### 1. Admin Setup Phase
```
1. Admin creates Teacher A with code TCH-ABC123
2. Admin creates Classroom "Math 101" with code MATH-101
3. Admin creates Classroom "Science 101" with code SCI-101
4. Admin assigns Teacher A → MATH-101
5. Admin assigns Teacher A → SCI-101
   (Teacher A can now manage both classrooms)
```

### 2. Student Enrollment Phase
```
1. Student visits registration page
2. Student enters: name, email, password, teacher_code (TCH-ABC123)
3. System validates teacher code and auto-selects MATH-101 (first assigned)
4. Student's account is created with classroom_id = 1 (MATH-101)
5. Email verification code sent
6. Student verifies email
7. Student logs in → Sees MATH-101 classroom content
```

### 3. Multi-Teacher Scenario
```
If Teacher B is also assigned to MATH-101:
- Both teachers can see the same students
- Both can upload documents, create questions
- Students see content from both teachers
```

---

## Files Modified

- **Models:** `backend/app/models/db_models.py`
  - Added `is_active` field to User
  - Made `teacher_code` unique

- **Schemas:** `backend/app/models/schemas.py`
  - Added `TeacherCreate`, `TeacherCreateResponse`, `TeacherResponse`
  - Added `StudentRegisterWithTeacher`, `StudentRegisterWithTeacherResponse`
  - Added `AssignTeacherRequest`, `AssignTeacherResponse`

- **Admin Router:** `backend/app/routers/admin.py`
  - Added `_ensure_unique_teacher_code()` helper
  - Updated POST `/api/admin/teachers` with schema validation
  - Updated POST `/api/admin/classrooms/{id}/assign-teacher` with schema validation
  - Updated imports

- **Auth Router:** `backend/app/routers/auth.py`
  - Added POST `/auth/register/teacher-code` endpoint
  - Added imports for new schemas
  - Already has `is_active` check in login

---

## Next Steps

1. **Run migrations** if using Alembic
2. **Test all endpoints** with Postman/Thunder Client
3. **Update frontend** to use new `/auth/register/teacher-code` endpoint
4. **Remove verification_code from response** in production
5. **Add rate limiting** to registration endpoints
6. **Monitor logs** for email delivery issues
