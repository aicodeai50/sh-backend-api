// models/Company.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Company = sequelize.define(
    "Company",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      plan: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "team",
      },

      seats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },

      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "companies",
      timestamps: false,
    }
  );

  return Company;
};