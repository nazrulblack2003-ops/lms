const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRole, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ===== IN-MEMORY DATABASE =====
const db = {
    users: [],
    courses: [],
    enrollments: [],
    transactions: [],
    certificates: []
};

let userIdCounter = 1;
let courseIdCounter = 1;
let enrollmentIdCounter = 1;
let transactionIdCounter = 1;
let certificateIdCounter = 1;

// Seed data
function initDatabase() {
    // Organization
    db.users.push({
        id: userIdCounter++,
        username: 'LMS Organization',
        email: 'org@lms.com',
        password: bcrypt.hashSync('org123', 10),
        role: 'organization',
        bankAccountNumber: 'ORG001',
        bankSecret: 'org-secret',
        balance: 100000
    });

    // Instructors
    const instructors = [
        { username: 'john_doe', email: 'john@lms.com', bankAccount: 'INST001', secret: 'john-secret' },
        { username: 'jane_smith', email: 'jane@lms.com', bankAccount: 'INST002', secret: 'jane-secret' },
        { username: 'bob_wilson', email: 'bob@lms.com', bankAccount: 'INST003', secret: 'bob-secret' }
    ];

    instructors.forEach(inst => {
        db.users.push({
            id: userIdCounter++,
            username: inst.username,
            email: inst.email,
            password: bcrypt.hashSync('instructor123', 10),
            role: 'instructor',
            bankAccountNumber: inst.bankAccount,
            bankSecret: inst.secret,
            balance: 5000
        });
    });

    // Courses
    const courses = [
        { title: 'Web Development Masterclass', description: 'Learn HTML, CSS, JavaScript and modern frameworks', instructorId: 2, price: 99.99 },
        { title: 'Data Science with Python', description: 'Complete guide to data science and machine learning', instructorId: 2, price: 149.99 },
        { title: 'Mobile App Development', description: 'Build iOS and Android apps with React Native', instructorId: 3, price: 129.99 },
        { title: 'Cloud Computing Fundamentals', description: 'AWS, Azure, and Google Cloud Platform basics', instructorId: 3, price: 89.99 },
        { title: 'Cybersecurity Essentials', description: 'Learn to protect systems and networks', instructorId: 4, price: 119.99 }
    ];

    courses.forEach(course => {
        db.courses.push({
            id: courseIdCounter++,
            ...course,
            videoUrl: 'https://example.com/video',
            materials: 'Course materials included',
            uploadDate: new Date().toISOString(),
            lumpSumPaid: 0
        });
    });

    console.log('✅ Database initialized');
    console.log(`   Users: ${db.users.length}, Courses: ${db.courses.length}`);
}

initDatabase();

// ===== AUTHENTICATION =====

app.post('/api/auth/register', (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }

    const user = {
        id: userIdCounter++,
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        role,
        bankAccountNumber: null,
        bankSecret: null,
        balance: 0
    };

    db.users.push(user);

    const token = jwt.sign({ id: user.id, username, role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
        success: true,
        message: 'User registered successfully',
        token,
        user: { id: user.id, username, email, role }
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    const user = db.users.find(u => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

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
});

// ===== USER ROUTES =====

app.get('/api/users/me', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            bankAccountNumber: user.bankAccountNumber,
            balance: user.balance
        }
    });
});

app.post('/api/users/bank-setup', authenticateToken, (req, res) => {
    const { bankAccountNumber, bankSecret } = req.body;

    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.bankAccountNumber = bankAccountNumber;
    user.bankSecret = bankSecret;
    user.balance = 1000; // Initial balance when setting up bank

    res.json({ success: true, message: 'Bank information updated successfully' });
});

app.post('/api/users/add-funds', authenticateToken, (req, res) => {
    const { amount } = req.body;

    if (!amount || amount < 1) {
        return res.status(400).json({ error: 'Invalid amount. Minimum deposit is $1.00' });
    }

    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.bankAccountNumber) {
        return res.status(400).json({ error: 'Please setup your bank account first' });
    }

    user.balance = (user.balance || 0) + parseFloat(amount);

    res.json({
        success: true,
        message: `Successfully deposited $${parseFloat(amount).toFixed(2)}`,
        newBalance: user.balance
    });
});

// ===== COURSE ROUTES =====

app.get('/api/courses', (req, res) => {
    const courses = db.courses.map(c => {
        const instructor = db.users.find(u => u.id === c.instructorId);
        return { ...c, instructorName: instructor?.username || 'Unknown' };
    });

    res.json({ success: true, courses });
});

app.post('/api/courses', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const { title, description, price, videoUrl, materials } = req.body;

    const course = {
        id: courseIdCounter++,
        title,
        description,
        instructorId: req.user.id,
        price: parseFloat(price),
        videoUrl: videoUrl || 'https://example.com/video',
        materials: materials || 'Course materials',
        uploadDate: new Date().toISOString(),
        lumpSumPaid: 0
    };

    db.courses.push(course);

    res.json({ success: true, message: 'Course created successfully', courseId: course.id });
});

app.get('/api/instructor/courses', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const courses = db.courses.filter(c => c.instructorId === req.user.id);
    res.json({ success: true, courses });
});

// ===== ENROLLMENT ROUTES =====

app.post('/api/enrollments', authenticateToken, authorizeRole('learner'), (req, res) => {
    const { courseId } = req.body;

    const course = db.courses.find(c => c.id === parseInt(courseId));
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const user = db.users.find(u => u.id === req.user.id);
    if (!user.bankAccountNumber) {
        return res.status(400).json({ error: 'Please setup your bank information first' });
    }

    if (db.enrollments.find(e => e.learnerId === req.user.id && e.courseId === parseInt(courseId))) {
        return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    const enrollment = {
        id: enrollmentIdCounter++,
        learnerId: req.user.id,
        courseId: parseInt(courseId),
        enrollmentDate: new Date().toISOString(),
        completed: 0,
        certificateIssued: 0
    };

    db.enrollments.push(enrollment);

    const instructor = db.users.find(u => u.id === course.instructorId);

    db.transactions.push({
        id: transactionIdCounter++,
        fromAccount: user.bankAccountNumber,
        toAccount: instructor.bankAccountNumber,
        amount: course.price,
        status: 'pending',
        type: 'course_payment',
        courseId: course.id,
        transactionDate: new Date().toISOString()
    });

    res.json({ success: true, message: 'Enrollment created. Transaction pending validation.', enrollmentId: enrollment.id });
});

app.get('/api/enrollments', authenticateToken, authorizeRole('learner'), (req, res) => {
    const enrollments = db.enrollments
        .filter(e => e.learnerId === req.user.id)
        .map(e => {
            const course = db.courses.find(c => c.id === e.courseId);
            const instructor = db.users.find(u => u.id === course?.instructorId);
            return {
                ...e,
                title: course?.title,
                description: course?.description,
                videoUrl: course?.videoUrl,
                materials: course?.materials,
                instructorName: instructor?.username
            };
        });

    res.json({ success: true, enrollments });
});

app.post('/api/enrollments/:id/complete', authenticateToken, authorizeRole('learner'), (req, res) => {
    const enrollment = db.enrollments.find(e => e.id === parseInt(req.params.id) && e.learnerId === req.user.id);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    enrollment.completed = 1;
    enrollment.certificateIssued = 1;

    const certificateNumber = 'CERT-' + Date.now() + '-' + uuidv4().substring(0, 8).toUpperCase();

    db.certificates.push({
        id: certificateIdCounter++,
        learnerId: req.user.id,
        courseId: enrollment.courseId,
        certificateNumber,
        issueDate: new Date().toISOString()
    });

    res.json({ success: true, message: 'Course completed! Certificate generated.', certificateNumber });
});

// ===== TRANSACTION ROUTES =====

app.get('/api/transactions/pending', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);

    const transactions = db.transactions
        .filter(t => t.toAccount === user.bankAccountNumber && t.status === 'pending')
        .map(t => {
            const course = db.courses.find(c => c.id === t.courseId);
            const learner = db.users.find(u => u.bankAccountNumber === t.fromAccount);
            return {
                ...t,
                courseTitle: course?.title,
                learnerName: learner?.username
            };
        });

    res.json({ success: true, transactions });
});

app.post('/api/transactions/:id/validate', authenticateToken, authorizeRole('instructor'), (req, res) => {
    const { approve } = req.body;
    const transaction = db.transactions.find(t => t.id === parseInt(req.params.id));

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    if (approve) {
        // Find the learner (payer) and instructor (receiver)
        const learner = db.users.find(u => u.bankAccountNumber === transaction.fromAccount);
        const instructor = db.users.find(u => u.bankAccountNumber === transaction.toAccount);

        if (!learner || !instructor) {
            return res.status(404).json({ error: 'User accounts not found' });
        }

        // Check if learner has sufficient balance
        if (learner.balance < transaction.amount) {
            return res.status(400).json({ error: 'Insufficient balance in learner account' });
        }

        // Transfer money
        learner.balance -= transaction.amount;
        instructor.balance = (instructor.balance || 0) + transaction.amount;

        // Update transaction status
        transaction.status = 'completed';
        transaction.validatedBy = req.user.id;
        transaction.completedDate = new Date().toISOString();

        const course = db.courses.find(c => c.id === transaction.courseId);
        if (course) course.lumpSumPaid = 1;

        res.json({
            success: true,
            message: `Transaction completed! $${transaction.amount} transferred to your account.`,
            newBalance: instructor.balance
        });
    } else {
        transaction.status = 'rejected';
        res.json({ success: true, message: 'Transaction rejected' });
    }
});

app.get('/api/transactions', authenticateToken, (req, res) => {
    let transactions;

    if (req.user.role === 'organization') {
        transactions = db.transactions.map(t => {
            const course = db.courses.find(c => c.id === t.courseId);
            return { ...t, courseTitle: course?.title };
        });
    } else {
        const user = db.users.find(u => u.id === req.user.id);
        transactions = db.transactions
            .filter(t => t.fromAccount === user.bankAccountNumber || t.toAccount === user.bankAccountNumber)
            .map(t => {
                const course = db.courses.find(c => c.id === t.courseId);
                return { ...t, courseTitle: course?.title };
            });
    }

    res.json({ success: true, transactions });
});

// ===== CERTIFICATES =====

app.get('/api/certificates', authenticateToken, authorizeRole('learner'), (req, res) => {
    const certificates = db.certificates
        .filter(c => c.learnerId === req.user.id)
        .map(cert => {
            const course = db.courses.find(c => c.id === cert.courseId);
            const instructor = db.users.find(u => u.id === course?.instructorId);
            return {
                ...cert,
                courseTitle: course?.title,
                instructorName: instructor?.username
            };
        });

    res.json({ success: true, certificates });
});

// ===== STATS =====

app.get('/api/stats', authenticateToken, authorizeRole('organization'), (req, res) => {
    const stats = {
        totalUsers: db.users.length,
        totalCourses: db.courses.length,
        totalEnrollments: db.enrollments.length,
        totalTransactions: db.transactions.length,
        totalRevenue: db.transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0)
    };

    res.json({ success: true, stats });
});

app.get('/health', (req, res) => {
    res.json({ status: 'LMS API is running (in-memory mode)' });
});

app.listen(PORT, () => {
    console.log(`🎓 LMS Server running on http://localhost:${PORT}`);
    console.log(`📝 Mode: In-Memory Database (data will reset on restart)`);
});
