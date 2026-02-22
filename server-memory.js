const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./database-memory');
const { authenticateToken, authorizeRole, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Helper function to make requests to bank API
const BANK_API_URL = 'http://localhost:3001/api/bank';

async function bankRequest(endpoint, method = 'GET', data = null) {
    const url = `${BANK_API_URL}${endpoint}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url);
    return await response.json();
}

// ===== AUTHENTICATION ROUTES =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['learner', 'instructor', 'organization'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);

        const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role)
      VALUES (?, ?, ?, ?)
    `);

        const result = stmt.run(username, email, hashedPassword, role);

        const token = jwt.sign(
            { id: result.lastInsertRowid, username, role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: result.lastInsertRowid,
                username,
                email,
                role
            }
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username or email already exists' });
        } else {
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                bankAccountNumber: user.bankAccountNumber,
                balance: user.balance
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// ===== USER ROUTES =====

// Get current user profile
app.get('/api/users/me', authenticateToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, email, role, bankAccountNumber, balance FROM users WHERE id = ?').get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Setup bank information for user
app.post('/api/users/bank-setup', authenticateToken, (req, res) => {
    const { bankAccountNumber, bankSecret } = req.body;

    if (!bankAccountNumber || !bankSecret) {
        return res.status(400).json({ error: 'Bank account number and secret are required' });
    }

    try {
        db.prepare(`
      UPDATE users 
      SET bankAccountNumber = ?, bankSecret = ?
      WHERE id = ?
    `).run(bankAccountNumber, bankSecret, req.user.id);

        res.json({
            success: true,
            message: 'Bank information updated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update bank information' });
    }
});

// ===== COURSE ROUTES =====

// Get all courses
app.get('/api/courses', (req, res) => {
    try {
        const courses = db.prepare(`
      SELECT c.*, u.username as instructorName
      FROM courses c
      JOIN users u ON c.instructorId = u.id
      ORDER BY c.uploadDate DESC
    `).all();

        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get course by ID
app.get('/api/courses/:id', (req, res) => {
    try {
        const course = db.prepare(`
      SELECT c.*, u.username as instructorName, u.email as instructorEmail
      FROM courses c
      JOIN users u ON c.instructorId = u.id
      WHERE c.id = ?
    `).get(req.params.id);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({ success: true, course });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch course' });
    }
});

// Create new course (Instructor only)
app.post('/api/courses', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const { title, description, price, videoUrl, materials } = req.body;

    if (!title || !price) {
        return res.status(400).json({ error: 'Title and price are required' });
    }

    try {
        const stmt = db.prepare(`
      INSERT INTO courses (title, description, instructorId, price, videoUrl, materials)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(title, description, req.user.id, price, videoUrl, materials);

        res.json({
            success: true,
            message: 'Course created successfully',
            courseId: result.lastInsertRowid
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create course' });
    }
});

// Update course (Instructor only)
app.put('/api/courses/:id', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const { title, description, price, videoUrl, materials } = req.body;

    try {
        const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (course.instructorId !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own courses' });
        }

        db.prepare(`
      UPDATE courses 
      SET title = ?, description = ?, price = ?, videoUrl = ?, materials = ?
      WHERE id = ?
    `).run(title, description, price, videoUrl, materials, req.params.id);

        res.json({
            success: true,
            message: 'Course updated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update course' });
    }
});

// Get instructor's courses
app.get('/api/instructor/courses', authenticateToken, authorizeRole('instructor'), (req, res) => {
    try {
        const courses = db.prepare('SELECT * FROM courses WHERE instructorId = ?').all(req.user.id);
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// ===== ENROLLMENT ROUTES =====

// Enroll in a course (Learner only)
app.post('/api/enrollments', authenticateToken, authorizeRole('learner'), async (req, res) => {
    const { courseId } = req.body;

    if (!courseId) {
        return res.status(400).json({ error: 'Course ID is required' });
    }

    try {
        const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        if (!user.bankAccountNumber || !user.bankSecret) {
            return res.status(400).json({ error: 'Please setup your bank information first' });
        }

        const instructor = db.prepare('SELECT * FROM users WHERE id = ?').get(course.instructorId);

        // Check if already enrolled
        const existing = db.prepare('SELECT * FROM enrollments WHERE learnerId = ? AND courseId = ?').get(req.user.id, courseId);

        if (existing) {
            return res.status(400).json({ error: 'Already enrolled in this course' });
        }

        // Create transaction request with bank
        // Note: In real implementation, we'd use fetch or axios here
        // For now, we'll create the enrollment and transaction record

        const stmt = db.prepare(`
      INSERT INTO enrollments (learnerId, courseId)
      VALUES (?, ?)
    `);

        const result = stmt.run(req.user.id, courseId);

        // Create transaction record
        const txnStmt = db.prepare(`
      INSERT INTO transactions (fromAccount, toAccount, amount, status, type, courseId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        txnStmt.run(user.bankAccountNumber, instructor.bankAccountNumber, course.price, 'pending', 'course_payment', courseId);

        res.json({
            success: true,
            message: 'Enrollment created. Transaction pending validation.',
            enrollmentId: result.lastInsertRowid
        });
    } catch (error) {
        res.status(500).json({ error: 'Enrollment failed: ' + error.message });
    }
});

// Get learner's enrollments
app.get('/api/enrollments', authenticateToken, authorizeRole('learner'), (req, res) => {
    try {
        const enrollments = db.prepare(`
      SELECT e.*, c.title, c.description, c.videoUrl, c.materials, u.username as instructorName
      FROM enrollments e
      JOIN courses c ON e.courseId = c.id
      JOIN users u ON c.instructorId = u.id
      WHERE e.learnerId = ?
      ORDER BY e.enrollmentDate DESC
    `).all(req.user.id);

        res.json({ success: true, enrollments });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

// Complete a course
app.post('/api/enrollments/:id/complete', authenticateToken, authorizeRole('learner'), (req, res) => {
    try {
        const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ? AND learnerId = ?').get(req.params.id, req.user.id);

        if (!enrollment) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        db.prepare('UPDATE enrollments SET completed = 1 WHERE id = ?').run(req.params.id);

        // Generate certificate
        const certificateNumber = 'CERT-' + Date.now() + '-' + uuidv4().substring(0, 8).toUpperCase();

        db.prepare(`
      INSERT INTO certificates (learnerId, courseId, certificateNumber)
      VALUES (?, ?, ?)
    `).run(req.user.id, enrollment.courseId, certificateNumber);

        db.prepare('UPDATE enrollments SET certificateIssued = 1 WHERE id = ?').run(req.params.id);

        res.json({
            success: true,
            message: 'Course completed! Certificate generated.',
            certificateNumber
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete course' });
    }
});

// ===== TRANSACTION ROUTES =====

// Get pending transactions (for instructor validation)
app.get('/api/transactions/pending', authenticateToken, authorizeRole('instructor'), (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        const transactions = db.prepare(`
      SELECT t.*, c.title as courseTitle, u.username as learnerName
      FROM transactions t
      JOIN courses c ON t.courseId = c.id
      JOIN users u ON t.fromAccount = u.bankAccountNumber
      WHERE t.toAccount = ? AND t.status = 'pending'
      ORDER BY t.transactionDate DESC
    `).all(user.bankAccountNumber);

        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Validate transaction (Instructor validates the payment)
app.post('/api/transactions/:id/validate', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const { approve } = req.body;

    try {
        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        if (transaction.toAccount !== user.bankAccountNumber) {
            return res.status(403).json({ error: 'You can only validate transactions to your account' });
        }

        if (approve) {
            db.prepare(`
        UPDATE transactions 
        SET status = 'validated', validatedBy = ?
        WHERE id = ?
      `).run(req.user.id, req.params.id);

            // Mark lump sum as paid for the course
            db.prepare('UPDATE courses SET lumpSumPaid = 1 WHERE id = ?').run(transaction.courseId);

            res.json({
                success: true,
                message: 'Transaction validated. Ready for bank transfer.'
            });
        } else {
            db.prepare('UPDATE transactions SET status = \'rejected\' WHERE id = ?').run(req.params.id);

            res.json({
                success: true,
                message: 'Transaction rejected'
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to validate transaction' });
    }
});

// Get all transactions (Organization can see all)
app.get('/api/transactions', authenticateToken, (req, res) => {
    try {
        let transactions;

        if (req.user.role === 'organization') {
            transactions = db.prepare(`
        SELECT t.*, c.title as courseTitle
        FROM transactions t
        LEFT JOIN courses c ON t.courseId = c.id
        ORDER BY t.transactionDate DESC
      `).all();
        } else {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

            transactions = db.prepare(`
        SELECT t.*, c.title as courseTitle
        FROM transactions t
        LEFT JOIN courses c ON t.courseId = c.id
        WHERE t.fromAccount = ? OR t.toAccount = ?
        ORDER BY t.transactionDate DESC
      `).all(user.bankAccountNumber, user.bankAccountNumber);
        }

        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// ===== CERTIFICATE ROUTES =====

// Get learner's certificates
app.get('/api/certificates', authenticateToken, authorizeRole('learner'), (req, res) => {
    try {
        const certificates = db.prepare(`
      SELECT cert.*, c.title as courseTitle, u.username as instructorName
      FROM certificates cert
      JOIN courses c ON cert.courseId = c.id
      JOIN users u ON c.instructorId = u.id
      WHERE cert.learnerId = ?
      ORDER BY cert.issueDate DESC
    `).all(req.user.id);

        res.json({ success: true, certificates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch certificates' });
    }
});

// ===== STATS ROUTES (for organization dashboard) =====

app.get('/api/stats', authenticateToken, authorizeRole('organization'), (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const totalCourses = db.prepare('SELECT COUNT(*) as count FROM courses').get();
        const totalEnrollments = db.prepare('SELECT COUNT(*) as count FROM enrollments').get();
        const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
        const totalRevenue = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE status = "completed"').get();

        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers.count,
                totalCourses: totalCourses.count,
                totalEnrollments: totalEnrollments.count,
                totalTransactions: totalTransactions.count,
                totalRevenue: totalRevenue.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'LMS API is running' });
});

app.listen(PORT, () => {
    console.log(`🎓 LMS Server running on http://localhost:${PORT}`);
});
