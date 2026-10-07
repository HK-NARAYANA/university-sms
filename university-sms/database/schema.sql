-- ============================================================
-- University Student Management System
-- Normalized MySQL Schema
-- ============================================================

DROP DATABASE IF EXISTS university_sms;
CREATE DATABASE university_sms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE university_sms;

-- ------------------------------------------------------------
-- DEPARTMENTS
-- ------------------------------------------------------------
CREATE TABLE departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,
    dept_code        VARCHAR(10)  NOT NULL UNIQUE,
    dept_name        VARCHAR(100) NOT NULL,
    building         VARCHAR(100),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- FACULTY
-- ------------------------------------------------------------
CREATE TABLE faculty (
    faculty_id       INT AUTO_INCREMENT PRIMARY KEY,
    first_name       VARCHAR(50)  NOT NULL,
    last_name        VARCHAR(50)  NOT NULL,
    email            VARCHAR(120) NOT NULL UNIQUE,
    title            ENUM('Professor','Associate Professor','Assistant Professor','Lecturer','Adjunct') NOT NULL,
    department_id    INT NOT NULL,
    hire_date        DATE NOT NULL,
    status           ENUM('active','on_leave','retired') NOT NULL DEFAULT 'active',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faculty_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- STUDENTS
-- ------------------------------------------------------------
CREATE TABLE students (
    student_id       INT AUTO_INCREMENT PRIMARY KEY,
    student_number   VARCHAR(20)  NOT NULL UNIQUE,
    first_name       VARCHAR(50)  NOT NULL,
    last_name        VARCHAR(50)  NOT NULL,
    email            VARCHAR(120) NOT NULL UNIQUE,
    date_of_birth    DATE,
    major_department_id INT NOT NULL,
    enrollment_year  YEAR NOT NULL,
    standing         ENUM('freshman','sophomore','junior','senior','graduate') NOT NULL DEFAULT 'freshman',
    status           ENUM('active','on_leave','graduated','withdrawn') NOT NULL DEFAULT 'active',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_students_department
        FOREIGN KEY (major_department_id) REFERENCES departments(department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- COURSES  (catalog entry, not tied to a term)
-- ------------------------------------------------------------
CREATE TABLE courses (
    course_id        INT AUTO_INCREMENT PRIMARY KEY,
    course_code      VARCHAR(10)  NOT NULL UNIQUE,   -- e.g. CS-301
    title            VARCHAR(150) NOT NULL,
    credits          TINYINT UNSIGNED NOT NULL CHECK (credits BETWEEN 1 AND 6),
    department_id    INT NOT NULL,
    description      TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- COURSE_SCHEDULE  (a specific offering of a course in a term)
-- ------------------------------------------------------------
CREATE TABLE course_schedule (
    schedule_id      INT AUTO_INCREMENT PRIMARY KEY,
    course_id        INT NOT NULL,
    faculty_id       INT NOT NULL,
    semester         ENUM('Fall','Spring','Summer') NOT NULL,
    academic_year    YEAR NOT NULL,
    days_of_week     VARCHAR(10) NOT NULL,   -- e.g. 'MWF', 'TTh'
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    room             VARCHAR(20) NOT NULL,
    capacity         SMALLINT UNSIGNED NOT NULL CHECK (capacity > 0),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedule_course
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_schedule_faculty
        FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_course_term_section
        UNIQUE (course_id, semester, academic_year, room, start_time),
    CONSTRAINT chk_time_order
        CHECK (start_time < end_time)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ENROLLMENTS  (a student registered into a specific offering)
-- ------------------------------------------------------------
CREATE TABLE enrollments (
    enrollment_id    INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL,
    schedule_id      INT NOT NULL,
    enrollment_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
    status           ENUM('enrolled','waitlisted','dropped','completed') NOT NULL DEFAULT 'enrolled',
    grade            ENUM('A','A-','B+','B','B-','C+','C','C-','D','F','IP') DEFAULT 'IP',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_enrollment_schedule
        FOREIGN KEY (schedule_id) REFERENCES course_schedule(schedule_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_student_schedule
        UNIQUE (student_id, schedule_id)   -- prevents double-enrollment in same offering
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Helpful indexes for common lookups
-- ------------------------------------------------------------
CREATE INDEX idx_students_department   ON students(major_department_id);
CREATE INDEX idx_faculty_department    ON faculty(department_id);
CREATE INDEX idx_courses_department    ON courses(department_id);
CREATE INDEX idx_schedule_course       ON course_schedule(course_id);
CREATE INDEX idx_schedule_faculty      ON course_schedule(faculty_id);
CREATE INDEX idx_enrollments_student   ON enrollments(student_id);
CREATE INDEX idx_enrollments_schedule  ON enrollments(schedule_id);

-- ------------------------------------------------------------
-- View: seats remaining per offering (used by enrollment module)
-- ------------------------------------------------------------
CREATE VIEW v_schedule_seats AS
SELECT
    cs.schedule_id,
    cs.capacity,
    COUNT(e.enrollment_id) AS seats_taken,
    cs.capacity - COUNT(e.enrollment_id) AS seats_available
FROM course_schedule cs
LEFT JOIN enrollments e
    ON e.schedule_id = cs.schedule_id AND e.status = 'enrolled'
GROUP BY cs.schedule_id, cs.capacity;
