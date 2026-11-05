import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_sri',
});

const [estados] = await conn.query(
  'SELECT estado, COUNT(*) AS n FROM comprobantes GROUP BY estado'
);
console.log('estados:', estados);

const [total] = await conn.query('SELECT COUNT(*) AS n FROM comprobantes');
console.log('total:', total[0].n);

const [pend] = await conn.query(`
  SELECT c.clave_acceso, c.estado, cx.id AS xml_id
  FROM comprobantes c
  LEFT JOIN comprobante_xmls cx ON cx.comprobante_id = c.id AND cx.tipo = 'autorizado'
  WHERE c.estado IN ('PENDIENTE','FIRMADO','ENVIADO','DEVUELTA','RECHAZADO')
     OR cx.id IS NULL
`);
console.log('need sync:', pend);

const [settings] = await conn.query(
  'SELECT last_sync_at, LEFT(last_sync_result, 500) AS result FROM tenant_settings LIMIT 1'
);
console.log('last sync:', settings);

await conn.end();
