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
import { ultimateNeoProxy } from '../controllers/ultimateneoproxy';
import { tomProxy } from '../controllers/tomProxy';
import { animetsuM3u8Proxy, animetsuSegmentProxy } from '../controllers/animetsuM3u8Proxy';
import { superProxy } from '../controllers/superProxy';
import { superTransform } from '../controllers/superTransform';
import { primeProxy } from '../controllers/primeProxy';
import { mp4Proxy } from '../controllers/mp4Proxy';
import { maxflixProxy } from '../controllers/maxflixProxy';

import { corsM3u8Proxy, corsTsProxy } from '../controllers/cors-m3u8-proxy';
;

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
router.get('/encoded-proxy', ultimateNeoProxy);
router.get('/tom-proxy',  (req, res, next) => {
  Promise.resolve(tomProxy(req, res)).catch(next);
});

router.get('/cors-m3u8-proxy', (req, res, next) => {
  Promise.resolve(corsM3u8Proxy(req, res)).catch(next);
});
router.get('/cors-ts-proxy', (req, res, next) => {
  Promise.resolve(corsTsProxy(req, res)).catch(next);
})
router.get('/animetsu-proxy-m3u8', (req, res, next) => {
  Promise.resolve(animetsuM3u8Proxy(req, res)).catch(next);
});
router.get('/animetsu-proxy-segment', (req, res, next) => {
  Promise.resolve(animetsuSegmentProxy(req, res)).catch(next);
});

router.get("/super-proxy", (req, res, next) => {
  Promise.resolve(superProxy(req, res)).catch(next);
});

router.get('/super-transform', (req, res, next) => {
  Promise.resolve(superTransform(req, res)).catch(next);
});

router.get('/prime-proxy', (req, res, next) => {
  Promise.resolve(primeProxy(req, res)).catch(next);
});


router.get('/mp4-proxy', (req, res, next) => {
  Promise.resolve(mp4Proxy(req, res)).catch(next);
});

router.get("/maxflix-proxy", maxflixProxy);
