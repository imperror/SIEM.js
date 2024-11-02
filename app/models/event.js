'use strict';
module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define(
    'Event',
    {
      eventType: DataTypes.STRING,
      alertId: DataTypes.STRING,
      timestamp: DataTypes.DATE,
      severity: DataTypes.STRING,
      source_ip: DataTypes.STRING,
      destination_ip: DataTypes.STRING,
      protocol: DataTypes.STRING,
      message: DataTypes.STRING,
      status: {
        type: DataTypes.STRING,
        defaultValue: 'new',
      },
    },
    {}
  );
  Event.associate = function (models) {
    // associations can be defined here
  };
  return Event;
};
