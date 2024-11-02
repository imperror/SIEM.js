// Migration file for Alerts table
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Alerts', {
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
      packetData: {
        type: Sequelize.TEXT // Ensure packet data is stored if required
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
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Alerts');
  }
};
