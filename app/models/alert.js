'use strict';
module.exports = (sequelize, DataTypes) => {
  const Alert = sequelize.define('Alert', {
    alertId: DataTypes.STRING,
    timestamp: DataTypes.DATE,
    severity: DataTypes.STRING,
    source_ip: DataTypes.STRING,
    destination_ip: DataTypes.STRING,
    protocol: DataTypes.STRING,
    message: DataTypes.STRING,
    status: DataTypes.STRING
  }, {});
  Alert.associate = function(models) {
    // associations can be defined here
  };
  return Alert;
};
