-- Esquema de las programaciones de trabajos (cambio OpenSpec `schedule-assign`).
--
-- Este script solo crea dos tablas nuevas: `job_schedules` (cada programación de un
-- trabajo en una fecha y hora) y `job_schedule_employees` (los empleados asignados a
-- cada programación). No modifica las tablas existentes `jobs` ni `employees`.
--
-- Antes de aplicarlo, verifica el tipo de los ids de las tablas existentes:
--
--   SHOW CREATE TABLE jobs;
--   SHOW CREATE TABLE employees;
--
-- Este script supone que `jobs.id` y `employees.id` son `INT UNSIGNED`. Si son de otro
-- tipo, ajusta las dos columnas de clave foránea (`job_schedules.job_id` y
-- `job_schedule_employees.employee_id`) para que tengan exactamente el mismo tipo,
-- porque MySQL lo exige.
--
-- Para revertir el esquema (no se ejecuta; descomenta solo si lo necesitas):
--
--   DROP TABLE job_schedule_employees;
--   DROP TABLE job_schedules;

CREATE TABLE job_schedules (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id         INT UNSIGNED NOT NULL,        -- mismo tipo EXACTO que jobs.id
  scheduled_date DATE         NOT NULL,
  start_time     TIME         NOT NULL,        -- solo hora de inicio
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_schedules_date (scheduled_date, start_time),
  CONSTRAINT fk_job_schedules_job FOREIGN KEY (job_id) REFERENCES jobs (id)
);

CREATE TABLE job_schedule_employees (
  job_schedule_id INT UNSIGNED NOT NULL,
  employee_id     INT UNSIGNED NOT NULL,       -- mismo tipo EXACTO que employees.id
  PRIMARY KEY (job_schedule_id, employee_id),
  KEY idx_jse_employee (employee_id),
  CONSTRAINT fk_jse_schedule FOREIGN KEY (job_schedule_id)
    REFERENCES job_schedules (id) ON DELETE CASCADE,
  CONSTRAINT fk_jse_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
);
