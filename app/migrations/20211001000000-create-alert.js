'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Alerts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      alertId: {
        type: Sequelize.STRING
      },
      timestamp: {
        type: Sequelize.DATE
      },
      severity: {
        type: Sequelize.STRING
      },
      source_ip: {
        type: Sequelize.STRING
      },
      destination_ip: {
        type: Sequelize.STRING
      },
      protocol: {
        type: Sequelize.STRING
      },
      message: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'new'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Alerts');
  }
};
