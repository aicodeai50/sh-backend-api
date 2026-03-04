// models/VmFile.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const VmFile = sequelize.define(
    "VmFile",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      vm_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      owner_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      path: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
        defaultValue: "",
      },
      content_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "text/plain",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "vm_files",
      timestamps: false,
    }
  );

  return VmFile;
};