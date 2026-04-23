// routes/groups.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    createGroup,
    getGroups,
    getGroup,
    updateGroup,
    addMember,
    leaveGroup,
    deleteGroup,
    getInviteLink,
    joinViaInvite
} = require('../controllers/groupController');

router.use(protect);

router.post('/join', joinViaInvite);
router.route('/').get(getGroups).post(createGroup);
router.route('/:id').get(getGroup).put(updateGroup).delete(deleteGroup);
router.post('/:id/members', addMember);
router.delete('/:id/leave', leaveGroup);
router.get('/:id/invite', getInviteLink);

module.exports = router;
