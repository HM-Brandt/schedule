-- Esquema de las programaciones de trabajos (cambio OpenSpec `schedule-assign`) y de
-- las ausencias de empleados (cambio OpenSpec `employee-absences`).
--
-- Este script solo crea tres tablas nuevas: `job_schedules` (cada programación de un
-- trabajo en una fecha y hora), `job_schedule_employees` (los empleados asignados a
-- cada programación) y `employee_absences` (una ausencia por empleado y día). No
-- modifica las tablas existentes `jobs` ni `employees`.
--
-- Para revertir el esquema (no se ejecuta; descomenta solo si lo necesitas):
--
--   DROP TABLE employee_absences;
--   DROP TABLE job_schedule_employees;
--   DROP TABLE job_schedules;

CREATE TABLE job_schedules (
  job_schedules_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  jobs_id          INT          NOT NULL,        -- mismo tipo EXACTO que jobs.jobs_id
  scheduled_date   DATE         NOT NULL,
  start_time       TIME         NOT NULL,        -- solo hora de inicio
  schedule_comment TEXT         NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_schedules_id),
  KEY idx_job_schedules_date (scheduled_date, start_time),
  CONSTRAINT fk_job_schedules_job FOREIGN KEY (jobs_id) REFERENCES jobs (jobs_id)
);

CREATE TABLE job_schedule_employees (
  job_schedules_id INT UNSIGNED NOT NULL,
  employees_id     INT          NOT NULL,        -- mismo tipo EXACTO que employees.employees_id
  PRIMARY KEY (job_schedules_id, employees_id),
  KEY idx_jse_employee (employees_id),
  CONSTRAINT fk_jse_schedule FOREIGN KEY (job_schedules_id)
    REFERENCES job_schedules (job_schedules_id) ON DELETE CASCADE,
  CONSTRAINT fk_jse_employee FOREIGN KEY (employees_id) REFERENCES employees (employees_id)
);

CREATE TABLE employee_absences (
  employee_absences_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employees_id         INT          NOT NULL,
  absence_date         DATE         NOT NULL,
  absence_type         ENUM('Off','Vacation','Sick','Other') NOT NULL,
  absence_comment      TEXT         NULL,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_absences_id),
  UNIQUE KEY uq_employee_absences_day (employees_id, absence_date),
  KEY idx_employee_absences_date (absence_date),
  CONSTRAINT fk_employee_absences_employee FOREIGN KEY (employees_id) REFERENCES employees (employees_id)
);
