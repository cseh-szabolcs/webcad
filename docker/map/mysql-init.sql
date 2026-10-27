-- Runs once, when the db volume is created. The app user may create and use app_main and every
-- tenant database app_<tenant> (and their _test variants).
GRANT ALL PRIVILEGES ON `app\_%`.* TO 'app'@'%';
