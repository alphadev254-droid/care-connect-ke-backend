require("dotenv").config();
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const columns = {
  credential_verification_status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: "not_started",
  },
  credential_verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  credential_verified_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  credential_verification_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
};

async function run() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const existing = await queryInterface.describeTable("caregivers");
    for (const [name, definition] of Object.entries(columns)) {
      if (existing[name]) {
        console.log(`No change needed: caregivers.${name} already exists.`);
        continue;
      }
      await queryInterface.addColumn("caregivers", name, definition);
      console.log(`Added caregivers.${name}.`);
    }
  } catch (error) {
    console.error("Caregiver credential migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
