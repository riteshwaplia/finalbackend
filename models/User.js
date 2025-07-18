const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'tenant_admin', 'user', 'team-member'], // 'team-member' role added
        default: 'user'
    },
    firstName: { // Added for team members
        type: String,
        trim: true,
        default: ''
    },
    lastName: { // Added for team members
        type: String,
        trim: true,
        default: ''
    },
    mobileNumber: { // Added for team members
        type: String,
        trim: true,
        default: ''
    },
    projectId: { // Link team members to specific projects
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: function() { return this.role === 'team-member'; }, // Required only for 'team-member' role
        index: true // Add index for efficient lookups by project
    },
    permissions: { // Define specific permissions for team members
        type: [String], // Array of strings, e.g., ['can_send_message', 'can_manage_contacts']
        default: []
    },
    isActive: { // Can activate/deactivate a user
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Update `updatedAt` on save
UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});


module.exports = mongoose.model('User', UserSchema);
