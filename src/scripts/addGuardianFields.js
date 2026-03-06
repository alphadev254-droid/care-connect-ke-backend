const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('patients', 'patientType', {
      type: DataTypes.ENUM('adult', 'child', 'elderly'),
      defaultValue: 'adult',
      allowNull: false
    });
    
    await queryInterface.addColumn('patients', 'guardianFirstName', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('patients', 'guardianLastName', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('patients', 'guardianPhone', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('patients', 'guardianEmail', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('patients', 'guardianRelationship', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('patients', 'guardianIdNumber', {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('patients', 'patientType');
    await queryInterface.removeColumn('patients', 'guardianFirstName');
    await queryInterface.removeColumn('patients', 'guardianLastName');
    await queryInterface.removeColumn('patients', 'guardianPhone');
    await queryInterface.removeColumn('patients', 'guardianEmail');
    await queryInterface.removeColumn('patients', 'guardianRelationship');
    await queryInterface.removeColumn('patients', 'guardianIdNumber');
  }
};