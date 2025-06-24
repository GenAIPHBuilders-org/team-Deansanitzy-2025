module.exports = {
  apps: [{
    name: 'kita-kita-bot',
    script: 'bot-with-connection.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development'
    },
    // Logging configuration
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_file: './logs/combined.log',
    time: true,
    // Restart configuration
    min_uptime: '10s',
    max_restarts: 10,
    // Exponential backoff restart delay
    restart_delay: 4000,
    // Graceful shutdown
    kill_timeout: 5000,
    // Monitoring
    monitoring: false
  }]
}; 