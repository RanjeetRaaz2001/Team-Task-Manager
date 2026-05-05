const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all projects (admin sees all, members see their projects)
router.get('/', auth, async (req, res) => {
    try {
        let projects;
        if (req.user.role === 'admin') {
            projects = await Project.find().populate('members', 'name email role');
        } else {
            projects = await Project.find({ members: req.user._id }).populate('members', 'name email role');
        }
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single project
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id).populate('members', 'name email role');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (req.user.role !== 'admin' && !project.members.some(m => m._id.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create project (admin only)
router.post('/', auth, adminOnly, [
    body('name').notEmpty().withMessage('Project name required'),
    body('description').notEmpty().withMessage('Description required'),
    body('deadline').isISO8601().withMessage('Valid deadline required'),
    body('members').isArray().withMessage('Members must be an array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const project = new Project({
            ...req.body,
            createdBy: req.user._id
        });
        await project.save();
        await project.populate('members', 'name email role');
        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update project (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('members', 'name email role');
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete project (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        // Delete all tasks in this project
        await Task.deleteMany({ projectId: req.params.id });
        const project = await Project.findByIdAndDelete(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;