require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { sequelize, Role, Permission, RolePermission, Specialty } = require('../models');

async function seedDatabase() {
  try {
    console.log('🔄 Seeding database with initial data...');

    await sequelize.authenticate();

    // Seed Roles
    await Role.bulkCreate([
      { name: 'patient',          description: 'Patient role with basic access' },
      { name: 'caregiver',        description: 'Caregiver role with care management access' },
      { name: 'regional_manager', description: 'Regional manager role with regional oversight' },
      { name: 'system_manager',   description: 'System manager role with full system access' }
    ], { ignoreDuplicates: true });

    // Seed Permissions — matches actual DB
    await Permission.bulkCreate([
      { name: 'view_dashboard',               description: 'View dashboard' },
      { name: 'system_admin',                 description: 'Full system administration' },
      { name: 'view_appointments',            description: 'View appointments' },
      { name: 'manage_appointments',          description: 'Create and manage appointments' },
      { name: 'view_reports',                 description: 'View care reports' },
      { name: 'manage_reports',               description: 'Create and manage care reports' },
      { name: 'view_care_plans',              description: 'View care plans' },
      { name: 'view_users',                   description: 'View all users' },
      { name: 'create_users',                 description: 'Create new users' },
      { name: 'view_patients',                description: 'View patient records' },
      { name: 'edit_patients',                description: 'Edit patient records' },
      { name: 'activate_patients',            description: 'Activate patient accounts' },
      { name: 'deactivate_patients',          description: 'Deactivate patient accounts' },
      { name: 'view_caregivers',              description: 'View caregiver records' },
      { name: 'edit_caregivers',              description: 'Edit caregiver records' },
      { name: 'activate_caregivers',          description: 'Activate caregiver accounts' },
      { name: 'deactivate_caregivers',        description: 'Deactivate caregiver accounts' },
      { name: 'view_accountants',             description: 'View accountant records' },
      { name: 'edit_accountants',             description: 'Edit accountant records' },
      { name: 'activate_accountants',         description: 'Activate accountant accounts' },
      { name: 'deactivate_accountants',       description: 'Deactivate accountant accounts' },
      { name: 'view_regional_managers',       description: 'View regional manager records' },
      { name: 'edit_regional_managers',       description: 'Edit regional manager records' },
      { name: 'activate_regional_managers',   description: 'Activate regional manager accounts' },
      { name: 'deactivate_regional_managers', description: 'Deactivate regional manager accounts' },
      { name: 'view_system_managers',         description: 'View system manager records' },
      { name: 'edit_system_managers',         description: 'Edit system manager records' },
      { name: 'activate_system_managers',     description: 'Activate system manager accounts' },
      { name: 'deactivate_system_managers',   description: 'Deactivate system manager accounts' },
      { name: 'view_roles',                   description: 'View roles' },
      { name: 'view_permissions',             description: 'View permissions' },
      { name: 'view_specialties',             description: 'View specialties' },
      { name: 'create_specialties',           description: 'Create specialties' },
      { name: 'edit_specialties',             description: 'Edit specialties' },
      { name: 'delete_specialties',           description: 'Delete specialties' },
      { name: 'view_financial_reports',       description: 'View financial reports' },
      { name: 'approve_caregivers',           description: 'Permission to approve or reject caregiver applications' },
      { name: 'view_withdrawal_requests',     description: 'View caregiver withdrawal requests and balances' },
      { name: 'manage_withdrawals',           description: 'Manage and process withdrawal requests' },
      { name: 'manage_patients',              description: 'Manage patient records' },
      { name: 'manage_caregivers',            description: 'Manage caregiver records' },
      { name: 'manage_users',                 description: 'Manage system users' },
      { name: 'assign_permissions',           description: 'Assign permissions to roles' },
      { name: 'delete_users',                 description: 'Delete inactive or deactivated users' },
      { name: 'view_paychangu_balance',       description: 'View PayChangu account balance' },
    ], { ignoreDuplicates: true });

    // Fetch actual roles and permissions from DB to get real IDs
    const allRoles = await Role.findAll();
    const allPerms = await Permission.findAll();

    const roleMap = {};
    allRoles.forEach(r => { roleMap[r.name] = r.id; });

    const permMap = {};
    allPerms.forEach(p => { permMap[p.name] = p.id; });

    console.log('📋 Role IDs:', roleMap);
    console.log('📋 Permission IDs:', permMap);

    const rp = (roleName, permNames) =>
      permNames.filter(pn => permMap[pn]).map(pn => ({ role_id: roleMap[roleName], permission_id: permMap[pn] }));

    const rolePermissions = [
      // Patient
      ...rp('patient', [
        'view_dashboard', 'view_appointments', 'view_caregivers', 'view_reports'
      ]),

      // Caregiver
      ...rp('caregiver', [
        'view_dashboard', 'manage_appointments', 'view_appointments',
        'view_patients', 'manage_reports', 'view_reports', 'view_financial_reports'
      ]),

      // Regional manager
      ...rp('regional_manager', [
        'view_dashboard', 'manage_appointments', 'view_appointments',
        'manage_patients', 'view_patients', 'manage_caregivers',
        'view_caregivers', 'manage_reports', 'view_reports', 'view_users',
        'view_care_plans', 'view_financial_reports', 'view_withdrawal_requests'
      ]),

      // System manager — all permissions
      ...rp('system_manager', Object.keys(permMap)),
    ];

    await RolePermission.bulkCreate(rolePermissions, { ignoreDuplicates: true });

    // Seed Specialties
    await Specialty.bulkCreate([
      { name: 'General Care',     description: 'General healthcare and assistance' },
      { name: 'Elderly Care',     description: 'Specialized care for elderly patients' },
      { name: 'Pediatric Care',   description: 'Healthcare for children' },
      { name: 'Mental Health',    description: 'Mental health support and counseling' },
      { name: 'Physical Therapy', description: 'Physical rehabilitation and therapy' },
      { name: 'Nursing Care',     description: 'Professional nursing services' }
    ], { ignoreDuplicates: true });

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase().finally(() => sequelize.close());
}

module.exports = seedDatabase;
