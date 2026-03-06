-- ============================================================
-- Add Withdrawal Management Permissions
-- Date: 2026-02-05
-- Description: Adds permissions for viewing and managing caregiver withdrawals
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- ============================================================
-- Add new withdrawal permissions
-- ============================================================
INSERT INTO `permissions` (`name`, `description`) VALUES
('view_withdrawal_requests', 'View caregiver withdrawal requests and balances'),
('manage_withdrawals', 'Manage and process withdrawal requests')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ============================================================
-- Assign withdrawal permissions to system_manager role
-- The system_manager role should have all permissions by default
-- ============================================================

-- Get the system_manager role ID and new permission IDs, then assign them
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT
    r.id AS role_id,
    p.id AS permission_id
FROM
    `roles` r
CROSS JOIN
    `permissions` p
WHERE
    r.name = 'system_manager'
    AND p.name IN ('view_withdrawal_requests', 'manage_withdrawals')
ON DUPLICATE KEY UPDATE role_id = role_id;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- ============================================================
-- Verification Query (optional - can be run manually to verify)
-- ============================================================
-- SELECT
--     r.name AS role_name,
--     p.name AS permission_name,
--     p.description AS permission_description
-- FROM role_permissions rp
-- INNER JOIN roles r ON rp.role_id = r.id
-- INNER JOIN permissions p ON rp.permission_id = p.id
-- WHERE p.name IN ('view_withdrawal_requests', 'manage_withdrawals')
-- ORDER BY r.name, p.name;
