const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Vm = sequelize.define(
    "Vm",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },

      owner_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      task: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "queued",
      },

      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      result_json: {
        type: DataTypes.TEXT, // store JSON as string
        allowNull: true,
      },

      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      finished_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "vms",
      timestamps: false,
    }
  );

  return Vm;
};