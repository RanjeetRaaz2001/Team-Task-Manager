 const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all tasks (filtered by role)
router.get('/', auth, async (req, res) => {
    try {
        let tasks;
        if (req.user.role === 'admin') {
            tasks = await Task.find()
                .populate('projectId', 'name')
                .populate('assigneeId', 'name email')
                .populate('createdBy', 'name');
        } else {
            tasks = await Task.find({ assigneeId: req.user._id })
                .populate('projectId', 'name')
                .populate('assigneeId', 'name email')
                .populate('createdBy', 'name');
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get tasks by project
router.get('/project/:projectId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (req.user.role !== 'admin' && !project.members.includes(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const tasks = await Task.find({ projectId: req.params.projectId })
            .populate('assigneeId', 'name email');
        
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create task
router.post('/', auth, [
    body('title').notEmpty().withMessage('Title required'),
    body('description').notEmpty().withMessage('Description required'),
    body('projectId').notEmpty().withMessage('Project ID required'),
    body('assigneeId').notEmpty().withMessage('Assignee required'),
    body('dueDate').isISO8601().withMessage('Valid due date required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const project = await Project.findById(req.body.projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check if user has access to this project
        if (req.user.role !== 'admin' && !project.members.includes(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const task = new Task({
            ...req.body,
            createdBy: req.user._id
        });
        await task.save();
        await task.populate('projectId', 'name');
        await task.populate('assigneeId', 'name email');
        
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update task
router.put('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const project = await Project.findById(task.projectId);
        
        // Check permissions
        if (req.user.role !== 'admin' && 
            task.assigneeId.toString() !== req.user._id.toString() &&
            project.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('projectId', 'name').populate('assigneeId', 'name email');
        
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete task (admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        await Task.findByIdAndDelete(req.params.id);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;