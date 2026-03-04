// models/CompanyMember.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const CompanyMember = sequelize.define(
    "CompanyMember",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },

      company_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "employee",
      },

      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "company_members",
      timestamps: false,
    }
  );

  return CompanyMember;
};