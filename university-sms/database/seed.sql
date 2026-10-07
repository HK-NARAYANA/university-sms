USE university_sms;

INSERT INTO departments (dept_code, dept_name, building) VALUES
('CS',  'Computer Science', 'Turing Hall'),
('MATH','Mathematics',      'Euler Building'),
('BIO', 'Biology',          'Darwin Center'),
('ENG', 'English',          'Woolf Hall');

INSERT INTO faculty (first_name, last_name, email, title, department_id, hire_date, status) VALUES
('Amara', 'Okafor',   'a.okafor@university.edu',   'Professor',           1, '2014-08-15', 'active'),
('Daniel','Reyes',    'd.reyes@university.edu',    'Associate Professor', 1, '2018-01-10', 'active'),
('Priya', 'Natarajan','p.natarajan@university.edu','Assistant Professor', 2, '2020-08-20', 'active'),
('Mei',   'Chen',     'm.chen@university.edu',     'Professor',           3, '2010-09-01', 'active'),
('Owen',  'Fitzgerald','o.fitzgerald@university.edu','Lecturer',          4, '2021-01-15', 'active');

INSERT INTO students (student_number, first_name, last_name, email, date_of_birth, major_department_id, enrollment_year, standing, status) VALUES
('S2024001', 'Liam',   'Carter',   'l.carter@university.edu',   '2004-03-12', 1, 2024, 'sophomore', 'active'),
('S2023045', 'Sofia',  'Martinez', 's.martinez@university.edu', '2003-07-22', 1, 2023, 'junior',    'active'),
('S2022089', 'Noah',   'Kim',      'n.kim@university.edu',      '2002-11-05', 2, 2022, 'senior',    'active'),
('S2024102', 'Ava',    'Johansson','a.johansson@university.edu','2004-01-30', 3, 2024, 'freshman',  'active'),
('S2023067', 'Ethan',  'Dubois',   'e.dubois@university.edu',   '2003-05-18', 4, 2023, 'junior',    'active');

INSERT INTO courses (course_code, title, credits, department_id, description) VALUES
('CS-101',  'Introduction to Programming',   4, 1, 'Foundations of programming using Python.'),
('CS-301',  'Database Systems',              4, 1, 'Relational theory, SQL, and schema design.'),
('MATH-210','Linear Algebra',                3, 2, 'Vector spaces, matrices, eigenvalues.'),
('BIO-150', 'Cell Biology',                  4, 3, 'Structure and function of the cell.'),
('ENG-220', 'Modern Literature',             3, 4, 'Survey of 20th century literature.');

INSERT INTO course_schedule (course_id, faculty_id, semester, academic_year, days_of_week, start_time, end_time, room, capacity) VALUES
(1, 1, 'Fall', 2026, 'MWF', '09:00:00', '09:50:00', 'TH-101', 40),
(2, 2, 'Fall', 2026, 'TTh', '11:00:00', '12:15:00', 'TH-204', 30),
(3, 3, 'Fall', 2026, 'MWF', '10:00:00', '10:50:00', 'EU-110', 35),
(4, 4, 'Fall', 2026, 'TTh', '13:00:00', '14:15:00', 'DC-050', 25),
(5, 5, 'Fall', 2026, 'MW',  '14:00:00', '15:15:00', 'WH-303', 20);

INSERT INTO enrollments (student_id, schedule_id, status, grade) VALUES
(1, 1, 'enrolled', 'IP'),
(1, 3, 'enrolled', 'IP'),
(2, 2, 'enrolled', 'IP'),
(2, 1, 'completed', 'A-'),
(3, 3, 'enrolled', 'IP'),
(4, 4, 'enrolled', 'IP'),
(5, 5, 'enrolled', 'IP');
