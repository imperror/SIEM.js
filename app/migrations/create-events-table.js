'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Events', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      eventType: {
        type: Sequelize.STRING, // e.g., "alert", "flow", "dns", etc.
      },
      alertId: {
        type: Sequelize.STRING,
        allowNull: true, // Nullable for non-alert events
      },
      timestamp: {
        type: Sequelize.DATE,
      },
      severity: {
        type: Sequelize.STRING,
        allowNull: true, // Nullable for non-alert events
      },
      source_ip: {
        type: Sequelize.STRING,
      },
      destination_ip: {
        type: Sequelize.STRING,
      },
      protocol: {
        type: Sequelize.STRING,
      },
      message: {
        type: Sequelize.STRING,
        allowNull: true, // Nullable for non-alert events
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'new',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Events');
  },
};
