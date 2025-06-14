import express from 'express';
import { m3u8Proxy } from '../controllers/m3u8-proxy';
import { m3u8Proxy2 } from '../controllers/m3u8-proxy-2';
import { m3u8Proxy3 } from '../controllers/m3u8-proxy-3';
import { m3u8Proxy4 } from '../controllers/meu8-proxy-4';
import { anizoneProxy } from '../controllers/anizone';
import { subtitleProxy } from '../controllers/subtitle';
import { cinemaosProxy } from '../controllers/cinemaosProxy';
import { miruroProxy } from '../controllers/miruro-proxy';
import { animetsuProxy } from '../controllers/animetsuProxy';
import { encodedProxy } from '../controllers/neoProxy';

export const router = express.Router();

router.get('/m3u8-proxy', m3u8Proxy);
router.get('/m3u8-proxy-2/', m3u8Proxy2);
router.get('/m3u8-proxy-3', m3u8Proxy3);
router.get('/m3u8-proxy-4', m3u8Proxy4);
router.get('/anizone', anizoneProxy);
router.get('/cinemaos-proxy', cinemaosProxy);
router.get('/miruro-proxy', miruroProxy);
router.get('/animetsu-proxy', (req, res, next) => {
  Promise.resolve(animetsuProxy(req, res)).catch(next);
});
router.get('/subtitle-proxy', (req, res, next) => {
  Promise.resolve(subtitleProxy(req, res)).catch(next);
});
router.get('/neo-proxy', encodedProxy);