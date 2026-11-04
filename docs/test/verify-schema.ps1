<#
.SYNOPSIS
  Verifica que docs/schema.sql se ejecuta sin errores en un MySQL de prueba
  (tarea 2.4 del cambio OpenSpec `schedule-assign`).

.DESCRIPTION
  1. Levanta un contenedor MySQL desechable, sin publicar puertos: todo se hace
     con `docker exec`, así no choca con el servicio MySQL local del 3306.
  2. Espera a que MySQL acepte conexiones.
  3. Crea las tablas `jobs` y `employees` equivalentes a las existentes.
  4. Guarda sus columnas (information_schema.COLUMNS) antes de aplicar el esquema.
  5. Ejecuta docs/schema.sql por stdin y falla si MySQL devuelve un error.
  6. Comprueba que existen las tablas nuevas, que las columnas de `jobs` y
     `employees` no cambiaron (escenario "Instalación del esquema") y hace un
     humo de las restricciones (PK compuesta, claves foráneas y ON DELETE CASCADE).
  7. Muestra OK o FALLO por cada comprobación y sale con 1 si algo falla.
  8. Borra el contenedor siempre, también si algo falla.

  Requiere Docker encendido. Uso, desde la raíz del repositorio:

    powershell -ExecutionPolicy Bypass -File docs\test\verify-schema.ps1

  Códigos de salida: 0 = todo OK; 1 = alguna comprobación falló o hubo un error;
  2 = Docker no está disponible.

.PARAMETER Imagen
  Imagen de MySQL. Por defecto `mysql:8.3`, la versión del servicio MySQL83 local.

.PARAMETER EsperaMaximaSegundos
  Tiempo máximo para que MySQL acepte conexiones.
#>
[CmdletBinding()]
param(
  [string]$Imagen = 'mysql:8.3',
  [int]$EsperaMaximaSegundos = 180
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Contenedor = 'schedule-ddl-test'
$BaseDatos = 'schedule_test'
$RutaEsquema = Join-Path $PSScriptRoot '..\schema.sql'

# Texto que se envía por stdin a `docker exec -i`: en UTF-8 sin BOM, porque el
# esquema tiene comentarios con tildes y Windows PowerShell 5.1 usa ASCII por defecto.
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

# Contraseña aleatoria de root, solo para este contenedor desechable.
$Clave = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })

# Resultado de cada comprobación.
$Resultados = New-Object System.Collections.Generic.List[object]

function Invoke-Docker {
  <#
    Ejecuta `docker` con los argumentos dados y devuelve el código de salida y la
    salida (stdout y stderr juntos). Si se pasa -Entrada, la envía por stdin.
    No lanza excepciones: quien llama decide qué hacer con el código.
  #>
  param(
    [Parameter(Mandatory)] [string[]]$Argumentos,
    [string]$Entrada
  )
  # Con 'Stop', Windows PowerShell 5.1 convierte cualquier línea de stderr de un
  # programa nativo en una excepción; aquí se captura como texto.
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    if ($PSBoundParameters.ContainsKey('Entrada')) {
      $salida = $Entrada | & docker @Argumentos 2>&1
    } else {
      $salida = & docker @Argumentos 2>&1
    }
    $codigo = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $anterior
  }
  [pscustomobject]@{
    Codigo = $codigo
    Salida = (@($salida) | ForEach-Object { "$_" }) -join "`n"
  }
}

function Invoke-MySql {
  <#
    Ejecuta SQL en la base de prueba con el cliente `mysql` del contenedor, por TCP
    (127.0.0.1) y en modo batch sin encabezados (-N -B). El SQL siempre va por
    stdin, así no hay problemas de comillas ni saltos de línea en los argumentos.
    En modo batch `mysql` se detiene en el primer error y sale con código 1.
    La contraseña va en MYSQL_PWD para que el cliente no avise de que está en la
    línea de comandos.
  #>
  param([Parameter(Mandatory)] [string]$Sql)
  $argumentos = @(
    'exec', '-i', '-e', "MYSQL_PWD=$Clave", $Contenedor,
    'mysql', '-h', '127.0.0.1', '-uroot', '--default-character-set=utf8mb4', '-N', '-B', $BaseDatos
  )
  return Invoke-Docker -Argumentos $argumentos -Entrada $Sql
}

function Assert-MySql {
  # Ejecuta SQL que debe funcionar; si MySQL devuelve un error, lanza una excepción.
  param([Parameter(Mandatory)] [string]$Sql, [Parameter(Mandatory)] [string]$Paso)
  $r = Invoke-MySql -Sql $Sql
  if ($r.Codigo -ne 0) {
    throw "$Paso falló (código $($r.Codigo)):`n$($r.Salida)"
  }
  return $r.Salida
}

function Add-Resultado {
  param([string]$Comprobacion, [bool]$Ok, [string]$Detalle = '')
  $Resultados.Add([pscustomobject]@{ Comprobacion = $Comprobacion; Ok = $Ok; Detalle = $Detalle })
  $estado = if ($Ok) { 'OK   ' } else { 'FALLO' }
  $color = if ($Ok) { 'Green' } else { 'Red' }
  Write-Host "[$estado] $Comprobacion" -ForegroundColor $color
  if ($Detalle -and -not $Ok) {
    Write-Host "        $($Detalle -replace "`n", "`n        ")"
  }
}

# Columnas de `jobs` y `employees` con todo lo que define su estructura.
$SqlColumnas = @"
SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
       IFNULL(COLUMN_DEFAULT, 'NULL'), COLUMN_KEY, EXTRA,
       IFNULL(CHARACTER_SET_NAME, ''), IFNULL(COLLATION_NAME, '')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '$BaseDatos' AND TABLE_NAME IN ('jobs', 'employees')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
"@

# --- Comprobación previa: Docker encendido -----------------------------------
$info = Invoke-Docker -Argumentos @('info', '--format', '{{.ServerVersion}}')
if ($info.Codigo -ne 0) {
  Write-Host 'Docker no está disponible. Enciende Docker Desktop y vuelve a ejecutar el script.' -ForegroundColor Yellow
  Write-Host $info.Salida
  exit 2
}
if (-not (Test-Path $RutaEsquema)) {
  Write-Host "No se encuentra el esquema en $RutaEsquema" -ForegroundColor Red
  exit 1
}

$CodigoSalida = 0
try {
  # Si quedó un contenedor de una ejecución anterior con este nombre, se borra.
  $null = Invoke-Docker -Argumentos @('rm', '-f', $Contenedor)

  # --- 1. Contenedor desechable, sin publicar puertos ------------------------
  Write-Host "Levantando $Imagen en el contenedor $Contenedor..."
  $run = Invoke-Docker -Argumentos @(
    'run', '-d', '--rm', '--name', $Contenedor,
    '-e', "MYSQL_ROOT_PASSWORD=$Clave", '-e', "MYSQL_DATABASE=$BaseDatos",
    $Imagen
  )
  if ($run.Codigo -ne 0) {
    throw "No se pudo arrancar el contenedor:`n$($run.Salida)"
  }

  # --- 2. Esperar a que MySQL acepte conexiones --------------------------------
  # Se prueba por TCP: durante la inicialización la imagen arranca un servidor
  # temporal sin red, y el definitivo solo escucha en TCP cuando ya existe la base.
  Write-Host "Esperando a MySQL (máximo $EsperaMaximaSegundos s)..."
  $limite = (Get-Date).AddSeconds($EsperaMaximaSegundos)
  $listo = $false
  while ((Get-Date) -lt $limite) {
    $estado = Invoke-Docker -Argumentos @('inspect', '-f', '{{.State.Running}}', $Contenedor)
    if ($estado.Codigo -ne 0 -or $estado.Salida.Trim() -ne 'true') {
      throw "El contenedor se detuvo antes de estar listo:`n$($estado.Salida)"
    }
    $ping = Invoke-Docker -Argumentos @(
      'exec', '-e', "MYSQL_PWD=$Clave", $Contenedor,
      'mysqladmin', 'ping', '-h', '127.0.0.1', '-uroot', '--silent'
    )
    if ($ping.Codigo -eq 0 -and (Invoke-MySql -Sql 'SELECT 1;').Codigo -eq 0) {
      $listo = $true
      break
    }
    Start-Sleep -Seconds 2
  }
  if (-not $listo) {
    throw "MySQL no aceptó conexiones en $EsperaMaximaSegundos s."
  }
  $version = Assert-MySql -Sql 'SELECT VERSION();' -Paso 'Consultar la versión'
  Write-Host "MySQL $version listo."

  # --- 3. Tablas equivalentes a las existentes ---------------------------------
  $null = Assert-MySql -Paso 'Crear jobs y employees' -Sql @"
CREATE TABLE jobs (
  id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  number VARCHAR(50)  NOT NULL,
  name   VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE employees (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  title      VARCHAR(100) NOT NULL,
  status     ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  PRIMARY KEY (id)
);
"@

  # --- 4. Columnas antes del esquema ------------------------------------------
  $columnasAntes = Assert-MySql -Sql $SqlColumnas -Paso 'Leer las columnas antes del esquema'

  # --- 5. Aplicar docs/schema.sql por stdin -----------------------------------
  $esquema = Get-Content -Raw -Encoding UTF8 -Path $RutaEsquema
  $aplicar = Invoke-MySql -Sql $esquema
  Add-Resultado -Comprobacion 'docs/schema.sql se ejecuta sin errores' `
    -Ok ($aplicar.Codigo -eq 0) -Detalle $aplicar.Salida
  if ($aplicar.Codigo -ne 0) {
    throw 'El esquema no se pudo aplicar; se omiten las demás comprobaciones.'
  }

  # --- 6. Comprobaciones -------------------------------------------------------
  # 6.1 Existen las dos tablas nuevas.
  $tablas = Assert-MySql -Paso 'Buscar las tablas nuevas' -Sql @"
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '$BaseDatos' AND TABLE_NAME IN ('job_schedules', 'job_schedule_employees')
ORDER BY TABLE_NAME;
"@
  $listaTablas = @($tablas -split "`n" | Where-Object { $_ -ne '' })
  Add-Resultado -Comprobacion 'Existen job_schedules y job_schedule_employees' `
    -Ok (($listaTablas -join ',') -eq 'job_schedule_employees,job_schedules') `
    -Detalle "Encontradas: $($listaTablas -join ', ')"

  # 6.2 Las columnas de jobs y employees no cambiaron.
  $columnasDespues = Assert-MySql -Sql $SqlColumnas -Paso 'Leer las columnas después del esquema'
  Add-Resultado -Comprobacion 'Las columnas de jobs y employees son idénticas a las de antes' `
    -Ok ($columnasAntes -ceq $columnasDespues) `
    -Detalle "Antes:`n$columnasAntes`nDespués:`n$columnasDespues"

  # 6.3 Humo: un trabajo, un empleado, una programación y su asignación.
  $insertar = Invoke-MySql -Sql @"
INSERT INTO jobs (id, number, name) VALUES (7, 'J-1024', 'Pintar oficina');
INSERT INTO employees (id, first_name, last_name, title, status) VALUES (3, 'Ana', 'Lopez', 'Pintora', 'activo');
INSERT INTO job_schedules (id, job_id, scheduled_date, start_time) VALUES (101, 7, '2026-11-02', '08:00');
INSERT INTO job_schedule_employees (job_schedule_id, employee_id) VALUES (101, 3);
"@
  Add-Resultado -Comprobacion 'Se insertan un trabajo, un empleado, una programación y su asignación' `
    -Ok ($insertar.Codigo -eq 0) -Detalle $insertar.Salida

  # La fecha y la hora se guardan tal cual (sin conversión de zona horaria).
  $guardada = Invoke-MySql -Sql "SELECT scheduled_date, TIME_FORMAT(start_time, '%H:%i') FROM job_schedules WHERE id = 101;"
  Add-Resultado -Comprobacion 'La programación guarda la fecha 2026-11-02 y la hora 08:00' `
    -Ok ($guardada.Codigo -eq 0 -and $guardada.Salida.Trim() -eq "2026-11-02`t08:00") -Detalle $guardada.Salida

  # Asignación duplicada: la PK compuesta debe rechazarla (error 1062).
  $duplicada = Invoke-MySql -Sql 'INSERT INTO job_schedule_employees (job_schedule_id, employee_id) VALUES (101, 3);'
  Add-Resultado -Comprobacion 'Una asignación duplicada falla por la PK compuesta (error 1062)' `
    -Ok ($duplicada.Codigo -ne 0 -and $duplicada.Salida -match 'ERROR 1062') -Detalle $duplicada.Salida

  # Claves foráneas: un trabajo o un empleado inexistentes se rechazan (error 1452).
  $sinTrabajo = Invoke-MySql -Sql "INSERT INTO job_schedules (job_id, scheduled_date, start_time) VALUES (999, '2026-11-02', '08:00');"
  Add-Resultado -Comprobacion 'Una programación con un trabajo inexistente falla por la FK (error 1452)' `
    -Ok ($sinTrabajo.Codigo -ne 0 -and $sinTrabajo.Salida -match 'ERROR 1452') -Detalle $sinTrabajo.Salida

  $sinEmpleado = Invoke-MySql -Sql 'INSERT INTO job_schedule_employees (job_schedule_id, employee_id) VALUES (101, 999);'
  Add-Resultado -Comprobacion 'Una asignación con un empleado inexistente falla por la FK (error 1452)' `
    -Ok ($sinEmpleado.Codigo -ne 0 -and $sinEmpleado.Salida -match 'ERROR 1452') -Detalle $sinEmpleado.Salida

  # Borrar la programación borra su asignación (ON DELETE CASCADE) y conserva el trabajo.
  $borrar = Invoke-MySql -Sql 'DELETE FROM job_schedules WHERE id = 101;'
  $restantes = Invoke-MySql -Sql 'SELECT COUNT(*) FROM job_schedule_employees WHERE job_schedule_id = 101;'
  Add-Resultado -Comprobacion 'Borrar la programación borra su asignación (ON DELETE CASCADE)' `
    -Ok ($borrar.Codigo -eq 0 -and $restantes.Codigo -eq 0 -and $restantes.Salida.Trim() -eq '0') `
    -Detalle "DELETE: $($borrar.Salida)`nAsignaciones restantes: $($restantes.Salida)"

  $trabajo = Invoke-MySql -Sql 'SELECT COUNT(*) FROM jobs WHERE id = 7;'
  Add-Resultado -Comprobacion 'El trabajo 7 sigue en jobs después de borrar la programación' `
    -Ok ($trabajo.Codigo -eq 0 -and $trabajo.Salida.Trim() -eq '1') -Detalle $trabajo.Salida
} catch {
  Add-Resultado -Comprobacion 'La verificación terminó sin errores inesperados' -Ok $false -Detalle "$_"
} finally {
  # --- 8. Borrar el contenedor siempre ----------------------------------------
  $borrado = Invoke-Docker -Argumentos @('rm', '-f', $Contenedor)
  if ($borrado.Codigo -eq 0) {
    Write-Host "Contenedor $Contenedor borrado."
  } else {
    Write-Host "No se pudo borrar el contenedor $Contenedor`: $($borrado.Salida)" -ForegroundColor Yellow
  }
}

# --- 7. Resumen y código de salida -------------------------------------------
$fallos = @($Resultados | Where-Object { -not $_.Ok })
Write-Host ''
if ($fallos.Count -eq 0) {
  Write-Host "Resultado: OK ($($Resultados.Count) comprobaciones)" -ForegroundColor Green
} else {
  Write-Host "Resultado: FALLO ($($fallos.Count) de $($Resultados.Count) comprobaciones)" -ForegroundColor Red
  $CodigoSalida = 1
}
exit $CodigoSalida
