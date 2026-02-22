const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

const bankAccounts = new Map();
const transactions = new Map();


bankAccounts.set('ORG001', { accountNumber: 'ORG001', secret: 'org-secret', balance: 100000, owner: 'LMS Organization' });
bankAccounts.set('INST001', { accountNumber: 'INST001', secret: 'john-secret', balance: 5000, owner: 'John Doe' });
bankAccounts.set('INST002', { accountNumber: 'INST002', secret: 'jane-secret', balance: 5000, owner: 'Jane Smith' });
bankAccounts.set('INST003', { accountNumber: 'INST003', secret: 'bob-secret', balance: 5000, owner: 'Bob Wilson' });


app.post('/api/bank/account/create', (req, res) => {
    const { owner } = req.body;

    if (!owner) {
        return res.status(400).json({ error: 'Owner name is required' });
    }

    const accountNumber = 'ACC' + Date.now() + Math.floor(Math.random() * 1000);
    const secret = uuidv4();

    const account = {
        accountNumber,
        secret,
        balance: 1000, 
        owner
    };

    bankAccounts.set(accountNumber, account);

    res.json({
        success: true,
        accountNumber,
        secret,
        message: 'Bank account created successfully'
    });
});


app.post('/api/bank/account/setup', (req, res) => {
    const { accountNumber, secret } = req.body;

    if (!accountNumber || !secret) {
        return res.status(400).json({ error: 'Account number and secret are required' });
    }

    const account = bankAccounts.get(accountNumber);

    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }

    if (account.secret !== secret) {
        return res.status(401).json({ error: 'Invalid secret key' });
    }

    res.json({
        success: true,
        accountNumber: account.accountNumber,
        balance: account.balance,
        owner: account.owner
    });
});

app.get('/api/bank/balance/:accountNumber', (req, res) => {
    const { accountNumber } = req.params;
    const { secret } = req.query;

    const account = bankAccounts.get(accountNumber);

    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }

    if (secret && account.secret !== secret) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
        success: true,
        accountNumber: account.accountNumber,
        balance: account.balance,
        owner: account.owner
    });
});


app.post('/api/bank/transaction/request', (req, res) => {
    const { fromAccount, toAccount, amount, type, reference } = req.body;

    if (!fromAccount || !toAccount || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sender = bankAccounts.get(fromAccount);
    const receiver = bankAccounts.get(toAccount);

    if (!sender || !receiver) {
        return res.status(404).json({ error: 'One or both accounts not found' });
    }

    if (sender.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }

    const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 10000);

    const transaction = {
        id: transactionId,
        fromAccount,
        toAccount,
        amount,
        type: type || 'payment',
        reference,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    transactions.set(transactionId, transaction);

    res.json({
        success: true,
        transactionId,
        message: 'Transaction request created. Awaiting validation.',
        transaction
    });
});


app.post('/api/bank/transaction/validate', (req, res) => {
    const { transactionId, accountNumber, secret, approve } = req.body;

    if (!transactionId || !accountNumber || !secret) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const transaction = transactions.get(transactionId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    const account = bankAccounts.get(accountNumber);

    if (!account || account.secret !== secret) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    
    if (transaction.toAccount !== accountNumber) {
        return res.status(403).json({ error: 'Only the receiver can validate this transaction' });
    }

    if (transaction.status !== 'pending') {
        return res.status(400).json({ error: 'Transaction already processed' });
    }

    if (approve) {
        transaction.status = 'validated';
        transaction.validatedAt = new Date().toISOString();

        res.json({
            success: true,
            message: 'Transaction validated successfully',
            transaction
        });
    } else {
        transaction.status = 'rejected';
        transactions.delete(transactionId);

        res.json({
            success: true,
            message: 'Transaction rejected',
            transaction
        });
    }
});


app.post('/api/bank/transaction/transfer', (req, res) => {
    const { transactionId } = req.body;

    if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transaction = transactions.get(transactionId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'validated') {
        return res.status(400).json({ error: 'Transaction must be validated before transfer' });
    }

    const sender = bankAccounts.get(transaction.fromAccount);
    const receiver = bankAccounts.get(transaction.toAccount);

    if (!sender || !receiver) {
        return res.status(404).json({ error: 'One or both accounts not found' });
    }

    if (sender.balance < transaction.amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }

    
    sender.balance -= transaction.amount;
    receiver.balance += transaction.amount;

    transaction.status = 'completed';
    transaction.completedAt = new Date().toISOString();

    res.json({
        success: true,
        message: 'Transfer completed successfully',
        transaction,
        newBalances: {
            sender: sender.balance,
            receiver: receiver.balance
        }
    });
});

app.get('/api/bank/transactions/:accountNumber', (req, res) => {
    const { accountNumber } = req.params;
    const { secret } = req.query;

    const account = bankAccounts.get(accountNumber);

    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }

    if (secret && account.secret !== secret) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accountTransactions = Array.from(transactions.values()).filter(
        t => t.fromAccount === accountNumber || t.toAccount === accountNumber
    );

    res.json({
        success: true,
        transactions: accountTransactions
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'Bank API is running', accounts: bankAccounts.size, transactions: transactions.size });
});

app.listen(PORT, () => {
    console.log(`🏦 Bank Simulation Server running on http://localhost:${PORT}`);
});
