-- Seed proxies de prueba para simular IPs distintas
-- Cada proxy tiene un host diferente para representar IPs distintas
-- En producción reemplazar con proxies reales (BrightData, Oxylabs, etc.)

INSERT INTO proxy_pool (proxy_host, proxy_port, proxy_user, proxy_pass, pais, activo, en_uso) VALUES
  ('proxy-ec-01.midominio.com', 3128, 'user1', 'pass1', 'EC', 1, 0),
  ('proxy-ec-02.midominio.com', 3128, 'user2', 'pass2', 'EC', 1, 0),
  ('proxy-ec-03.midominio.com', 3128, 'user3', 'pass3', 'EC', 1, 0),
  ('proxy-ec-04.midominio.com', 3128, 'user4', 'pass4', 'EC', 1, 0),
  ('proxy-ec-05.midominio.com', 3128, 'user5', 'pass5', 'EC', 1, 0);
