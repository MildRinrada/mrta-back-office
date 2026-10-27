/**
 * กล่องครอปวิดีโอ / GIF ของฟอร์มแบนเนอร์ (TOR มัลติมีเดีย) - ไฟล์นี้มีเหมือนกันทุกระบบที่มีแบนเนอร์
 * คู่กับ resources/views/shared/banner_media_crop_modal.blade.php และ App\Services\BannerMedia
 *
 * ── ทำงานอย่างไร ──
 * ใช้ <input type="file"> ช่องเดิมของฟอร์ม (ช่องเดียวรับทั้งรูปและวิดีโอ)
 *  - รูปนิ่ง (.jpg .png .bmp) : ปล่อยผ่านให้กล่องตัดรูปเดิม (ImageCropper) / ตัวอย่างเดิมของฟอร์มทำงานตามปกติ
 *  - วิดีโอ / GIF           : ดัก event change ไว้ก่อน (capture ที่ <form>) ไม่ให้ไปถึง ImageCropper
 *                             เพราะ ImageCropper วาดผ่าน canvas แล้วออกเป็น JPEG = GIF หยุดนิ่ง / วิดีโอเปิดไม่ได้
 *    แล้วเปิดกล่องครอป: เฟรมของวิดีโอถูกวาดเป็นภาพนิ่งให้ Cropper.js ลากกรอบ (สัดส่วนล็อกตามขนาดแบนเนอร์)
 *    เลื่อนแถบเฟรมได้ (cropper.replace(..., true) สลับภาพโดยกรอบไม่ขยับ) และเห็นวิดีโอจริงที่ครอปแล้วเล่นวนในช่องตัวอย่าง
 *    กดยืนยัน = ไฟล์ต้นฉบับอยู่ใน input เดิม + กรอบครอป (สัดส่วน 0-1) ในช่อง media_crop
 *              + ภาพปก (เฟรมที่หยุดไว้ ครอปแล้ว เป็น JPEG) ในช่อง media_poster
 *    เซิร์ฟเวอร์มี ffmpeg = ครอป/แปลงจริงตอนบันทึก / ไม่มี = เก็บต้นฉบับแล้วครอปตอนแสดงผลด้วย CSS
 *
 * ใช้งาน:
 *   BannerMediaCropper.attach({
 *       input:   '#formFile',               // input ไฟล์ของฟอร์ม (จำเป็น)
 *       modal:   '#modal_crop_banner_media',// markup จาก shared/banner_media_crop_modal (จำเป็น)
 *       preview: '#formFile_preview',       // กล่องตัวอย่างในฟอร์ม (จะใส่หรือไม่ก็ได้)
 *       config:  {...},                     // BannerMedia::clientConfig($presets) (จำเป็น)
 *       current: {...},                     // BannerMedia::info($banner) ของแบนเนอร์ที่กำลังแก้ (จะใส่หรือไม่ก็ได้)
 *   });
 */
window.BannerMediaCropper = (function () {
    'use strict';

    var STATIC_EXTS  = ['jpg', 'jpeg', 'png', 'bmp'];
    var IMAGE_EXTS   = STATIC_EXTS.concat(['gif']);
    var ALL_VIDEO    = ['mp4', 'webm', 'avi', 'flv', 'mpeg', 'mpg', 'wmv', '3gp'];
    var WORK_PX      = 1600;   // ด้านยาวสุดของเฟรมที่ให้ลากกรอบ (ผลลัพธ์จริงใช้สัดส่วน ไม่ได้ใช้พิกเซลนี้)
    var POSTER_MAX_W = 1920;   // ภาพปกกว้างไม่เกินนี้ (เซิร์ฟเวอร์ย่อซ้ำไม่เกินขนาดแบนเนอร์อีกชั้น)

    function extOf(name) {
        var i = String(name || '').lastIndexOf('.');
        return i > -1 ? name.slice(i + 1).toLowerCase() : '';
    }

    function fmt(s, vars) {
        return String(s || '').replace(/:(\w+)/g, function (m, k) {
            return vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m;
        });
    }

    function clamp(v, lo, hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    function timeLabel(t) {
        t = Math.max(0, t || 0);
        var m = Math.floor(t / 60), s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function defaultError(msg) {
        if (window.Swal) {
            window.Swal.fire({ icon: 'warning', text: msg, confirmButtonText: 'ตกลง' });
        } else {
            window.alert(msg);
        }
    }

    function setFiles(input, files) {
        var dt = new DataTransfer();
        (files || []).forEach(function (f) { if (f) { dt.items.add(f); } });
        input.files = dt.files;
    }

    /** ใส่สไตล์ครอปด้วย CSS ให้สื่อในกรอบ - สูตรเดียวกับ BannerMedia::cropStyle() */
    function applyCrop(el, c) {
        if (!c || c.mode === 'center') {
            el.classList.remove('is-cropped');
            el.style.width = el.style.height = el.style.left = el.style.top = '';
            return;
        }
        var w = Math.max(c.w, 0.0001), h = Math.max(c.h, 0.0001);
        el.classList.add('is-cropped');
        el.style.width  = (100 / w) + '%';
        el.style.height = (100 / h) + '%';
        el.style.left   = (-100 * c.x / w) + '%';
        el.style.top    = (-100 * c.y / h) + '%';
    }

    /** กรอบแสดงผลแบบเดียวกับ shared/banner_media.blade.php */
    function buildFrame(o) {
        var frame = document.createElement('div');
        frame.className = 'bm-frame' + (o.extraClass ? ' ' + o.extraClass : '');
        frame.style.setProperty('--bm-ratio', o.w + ' / ' + o.h);
        frame.style.setProperty('--bm-r', String(o.w / o.h));
        frame.setAttribute('data-bm', o.type);

        var box = document.createElement('div');
        box.className = 'bm-box';
        frame.appendChild(box);

        if (o.poster) {
            var p = document.createElement('img');
            p.className = 'bm-poster';
            p.alt = '';
            p.src = o.poster;
            box.appendChild(p);
        }

        var media = null;
        if (o.src && o.type === 'video') {
            media = document.createElement('video');
            media.muted = true;
            media.loop = true;
            media.autoplay = true;
            media.playsInline = true;
            media.setAttribute('muted', '');
            media.setAttribute('playsinline', '');
            media.setAttribute('aria-hidden', 'true');
            media.preload = 'auto';
            media.className = 'bm-media bm-video';
            media.src = o.src;
        } else if (o.src) {
            media = document.createElement('img');
            media.alt = '';
            media.className = 'bm-media bm-gif';
            media.src = o.src;
        } else {
            var icon = document.createElement('div');
            icon.className = 'bm-novideo';
            icon.innerHTML = '<i class="fa-solid fa-film"></i>';
            box.appendChild(icon);
        }
        if (media) {
            box.appendChild(media);
            applyCrop(media, o.crop);
        }

        if (o.badge) {
            var b = document.createElement('span');
            b.className = 'bm-badge';
            b.innerHTML = '<i class="fa-solid ' + (o.type === 'video' ? 'fa-play' : 'fa-wand-magic-sparkles') + '"></i> ';
            b.appendChild(document.createTextNode(o.badge));
            frame.appendChild(b);
        }

        return { frame: frame, media: media };
    }

    function attach(opt) {
        var input = document.querySelector(opt.input);
        var modal = document.querySelector(opt.modal);
        if (!input || !modal) {
            return;
        }
        var form = input.form || input.closest('form');
        if (!form) {
            return;
        }

        var cfg     = opt.config || {};
        var i18n    = {};
        try { i18n = JSON.parse(modal.getAttribute('data-i18n') || '{}'); } catch (e) { i18n = {}; }
        var onError = opt.onError || defaultError;
        var previewBox = opt.preview ? document.querySelector(opt.preview) : null;
        var presets = (cfg.presets && cfg.presets.length) ? cfg.presets : [{ key: 'default', label: '', width: 16, height: 9 }];
        var preset  = presets[0];
        presets.forEach(function (p) { if (cfg.presetKey && p.key === cfg.presetKey) { preset = p; } });
        var videoExts = cfg.videoExts || ['mp4', 'webm'];
        var maxBytes  = (cfg.maxVideoKb || 102400) * 1024;

        function q(n) { return modal.querySelector('[data-bmc="' + n + '"]'); }
        var el = {
            title: q('title'), loading: q('loading'), nopreview: q('nopreview'), editor: q('editor'),
            image: q('image'), scrubrow: q('scrubrow'), scrub: q('scrub'), time: q('time'), scrubhint: q('scrubhint'),
            presets: q('presets'), presetlist: q('presetlist'), play: q('play'), preview: q('preview'),
            output: q('output'), mode: q('mode'), submit: q('submit'),
        };

        // ช่องที่ส่งไปกับฟอร์ม - สร้างไว้ใน <form> (modal อาจอยู่นอกฟอร์ม)
        var cropField = form.querySelector('input[name="media_crop"]');
        if (!cropField) {
            cropField = document.createElement('input');
            cropField.type = 'hidden';
            cropField.name = 'media_crop';
            form.appendChild(cropField);
        }
        var posterField = form.querySelector('input[name="media_poster"]');
        if (!posterField) {
            posterField = document.createElement('input');
            posterField.type = 'file';
            posterField.name = 'media_poster';
            posterField.accept = 'image/jpeg';
            posterField.hidden = true;
            posterField.tabIndex = -1;
            posterField.setAttribute('aria-hidden', 'true');
            form.appendChild(posterField);
        }

        var committed = null;  // ไฟล์ที่ยืนยันแล้ว {file, kind, url, crop, poster, preset}
        var s = null;          // รอบการครอปที่เปิดอยู่
        var bsModal = null;
        var modalShown = false;
        var formFrame = null;

        /* ---------------- ตัวอย่างในฟอร์ม ---------------- */

        function clearFormPreview() {
            if (formFrame && formFrame.parentNode) {
                formFrame.parentNode.removeChild(formFrame);
            }
            formFrame = null;
            if (previewBox) {
                previewBox.classList.remove('bm-has-media');
            }
        }

        function showFormPreview(o) {
            if (!previewBox) {
                return;
            }
            clearFormPreview();
            var badge = o.type === 'video' ? (i18n.badge_video || 'Video') : (i18n.badge_gif || 'GIF');
            var built = buildFrame({ type: o.type, src: o.src, poster: o.poster, crop: o.crop, w: o.w, h: o.h, badge: badge,
                extraClass: previewBox.classList.contains('lx-img-preview') ? '' : 'bm-form-frame' });
            formFrame = built.frame;
            previewBox.insertBefore(formFrame, previewBox.firstChild);
            previewBox.classList.add('bm-has-media', 'has-image');
            previewBox.classList.remove('is-placeholder');
            if (previewBox.style.display === 'none') {
                previewBox.style.display = '';
            }
        }

        function markChanged() {
            var body = input.closest('.lx-img-body');
            if (body) {
                body.classList.add('is-changed');
            }
        }

        /* ---------------- รอบการครอป ---------------- */

        function teardown() {
            if (!s) {
                return;
            }
            if (s.cropper) {
                s.cropper.destroy();
            }
            if (s.video) {
                s.video.pause();
                s.video.removeAttribute('src');
                s.video.load();
            }
            if (s.previewMedia && s.previewMedia.tagName === 'VIDEO') {
                s.previewMedia.pause();
                s.previewMedia.removeAttribute('src');
            }
            if (s.timer) {
                clearTimeout(s.timer);
            }
            if (!s.keepUrl && s.url) {
                URL.revokeObjectURL(s.url);
            }
            el.image.onload = el.image.onerror = null;
            el.image.removeAttribute('src');
            el.preview.innerHTML = '';
            s = null;
        }

        function renderPresets() {
            el.presets.hidden = presets.length < 2;
            el.presetlist.innerHTML = '';
            if (presets.length < 2) {
                return;
            }
            presets.forEach(function (p, i) {
                var id = modal.id + '_preset_' + i;
                var wrap = document.createElement('div');
                wrap.className = 'form-check';
                var r = document.createElement('input');
                r.type = 'radio';
                r.className = 'form-check-input';
                r.name = modal.id + '_preset';
                r.id = id;
                r.checked = p.key === preset.key;
                r.addEventListener('change', function () {
                    if (r.checked) {
                        preset = p;
                        if (s && s.cropper) {
                            s.cropper.setAspectRatio(p.width / p.height);
                        }
                        updateInfo();
                        buildPreview();
                    }
                });
                var l = document.createElement('label');
                l.className = 'form-check-label';
                l.htmlFor = id;
                l.textContent = (p.label ? p.label + ' ' : '') + '(' + p.width + ' × ' + p.height + ')';
                wrap.appendChild(r);
                wrap.appendChild(l);
                el.presetlist.appendChild(wrap);
            });
        }

        function updateInfo() {
            el.output.innerHTML = '<i class="fa-solid fa-expand"></i> ' + fmt(i18n.crop_output, { w: preset.width, h: preset.height });
            var modeText = (s && s.kind === 'video' && cfg.ffmpeg) ? i18n.crop_mode_ffmpeg : i18n.crop_mode_css;
            el.mode.innerHTML = '<i class="fa-solid fa-gear"></i> ' + (modeText || '');
        }

        function currentCrop() {
            if (!s || !s.cropper) {
                return null;
            }
            var d  = s.cropper.getData();
            var im = s.cropper.getImageData();
            var nw = im.naturalWidth || 1, nh = im.naturalHeight || 1;
            var w = clamp(d.width / nw, 0.01, 1), h = clamp(d.height / nh, 0.01, 1);
            return {
                mode: 'rect',
                x: clamp(d.x / nw, 0, 1 - w),
                y: clamp(d.y / nh, 0, 1 - h),
                w: w,
                h: h,
            };
        }

        // ช่องตัวอย่าง = สื่อจริง (วิดีโอเล่นวน / GIF ขยับ) ครอปด้วย CSS ตามกรอบปัจจุบัน
        function buildPreview() {
            if (!s) {
                return;
            }
            el.preview.innerHTML = '';
            var built = buildFrame({ type: s.kind, src: s.url, crop: currentCrop(), w: preset.width, h: preset.height });
            s.previewMedia = built.media;
            el.preview.appendChild(built.frame);
            if (built.media && built.media.tagName === 'VIDEO') {
                built.media.addEventListener('play', setPlayIcon);
                built.media.addEventListener('pause', setPlayIcon);
            }
            setPlayIcon();
        }

        function setPlayIcon() {
            var v = s && s.previewMedia && s.previewMedia.tagName === 'VIDEO' ? s.previewMedia : null;
            el.play.hidden = !v;
            if (v) {
                el.play.innerHTML = v.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
            }
        }

        function startCropper() {
            if (!s || s.cropper || !modalShown || !s.imageReady) {
                return;
            }
            el.loading.hidden = true;
            el.editor.hidden = false;
            s.cropper = new window.Cropper(el.image, {
                aspectRatio: preset.width / preset.height,
                viewMode: 1,          // กรอบออกนอกภาพไม่ได้
                autoCropArea: 1,      // เริ่มที่กรอบใหญ่สุดที่ได้สัดส่วนนี้
                dragMode: 'none',     // ลากเฉพาะกรอบ ไม่ขยับ/ซูมภาพ - พิกัดจึงตรงกับต้นฉบับเสมอ
                zoomable: false,
                movable: false,
                rotatable: false,
                scalable: false,
                background: false,
                responsive: true,
                checkOrientation: false,
                ready: function () {
                    // replace() ตอนเลื่อนเฟรมก็ยิง ready - ไม่ต้องสร้างช่องตัวอย่างใหม่ (วิดีโอตัวอย่างจะกระตุกเริ่มใหม่)
                    if (s && !s.previewMedia) {
                        buildPreview();
                    }
                    el.submit.disabled = false;
                },
                crop: function () {
                    if (s && s.previewMedia) {
                        applyCrop(s.previewMedia, currentCrop());
                    }
                },
            });
        }

        // วาดเฟรมปัจจุบันของวิดีโอเป็นภาพนิ่งให้ Cropper
        function grabFrame() {
            var v = s.video;
            var scale = Math.min(1, WORK_PX / Math.max(v.videoWidth, v.videoHeight));
            var c = document.createElement('canvas');
            c.width  = Math.max(1, Math.round(v.videoWidth * scale));
            c.height = Math.max(1, Math.round(v.videoHeight * scale));
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            return c.toDataURL('image/jpeg', 0.85);
        }

        function showFrame() {
            if (!s || !s.video) {
                return;
            }
            var url;
            try {
                url = grabFrame();
            } catch (e) {
                return noPreview();
            }
            if (s.cropper) {
                s.cropper.replace(url, true); // ขนาดเท่าเดิม - กรอบไม่ขยับ
            } else {
                el.image.onload = function () {
                    s.imageReady = true;
                    startCropper();
                };
                el.image.src = url;
            }
        }

        // เบราว์เซอร์ถอดรหัสไฟล์นี้ไม่ได้ (เช่น .avi .wmv) - ถ้ามี ffmpeg ให้เซิร์ฟเวอร์ครอปกึ่งกลางเอง
        function noPreview() {
            if (!s) {
                return;
            }
            if (s.kind === 'video' && cfg.ffmpeg) {
                s.center = true;
                el.loading.hidden = true;
                el.editor.hidden = true;
                el.nopreview.hidden = false;
                el.submit.disabled = false;
                return;
            }
            var name = s.file.name;
            closeModal();
            onError(fmt(i18n.js_read_fail, { name: name }));
        }

        function openVideo() {
            var v = document.createElement('video');
            v.muted = true;
            v.playsInline = true;
            v.preload = 'auto';
            v.setAttribute('muted', '');
            v.setAttribute('playsinline', '');
            s.video = v;

            v.addEventListener('loadeddata', function () {
                if (!s || s.video !== v || s.loaded) {
                    return;
                }
                s.loaded = true;
                s.w = v.videoWidth;
                s.h = v.videoHeight;
                if (!s.w || !s.h) {
                    return noPreview();
                }
                // WebM ที่อัดจากเบราว์เซอร์มักไม่มีความยาวในหัวไฟล์ (Infinity) - กระโดดไปท้ายไฟล์ครั้งหนึ่งให้รู้ความยาวจริง
                if (!isFinite(v.duration) || !v.duration) {
                    s.fixing = true;
                    v.currentTime = 1e7;
                } else {
                    setDuration(v.duration);
                    v.currentTime = Math.min(0.05, v.duration / 2);
                }
                // กันกรณี seeked ไม่มา (บางไฟล์/บางเบราว์เซอร์) - ใช้เฟรมที่มีอยู่ไปเลย
                s.timer = setTimeout(function () {
                    if (s && s.video === v && !s.cropper && !s.imageReady) {
                        s.fixing = false;
                        showFrame();
                    }
                }, 2500);
            });
            v.addEventListener('seeked', function () {
                if (!s || s.video !== v) {
                    return;
                }
                if (s.fixing) {
                    s.fixing = false;
                    setDuration(v.duration);
                    v.currentTime = 0;
                    return;
                }
                el.time.textContent = timeLabel(v.currentTime) + ' / ' + timeLabel(s.duration);
                showFrame();
            });
            v.addEventListener('error', function () {
                if (s && s.video === v) {
                    noPreview();
                }
            });
            v.src = s.url;
            v.load();
        }

        function setDuration(d) {
            s.duration = isFinite(d) ? d : 0;
            el.scrub.max = String(Math.max(0, s.duration - 0.05));
            el.scrub.value = '0';
            el.scrub.disabled = s.duration <= 0;
            el.time.textContent = timeLabel(0) + ' / ' + timeLabel(s.duration);
        }

        function openGif() {
            var probe = new Image();
            probe.onload = function () {
                if (!s) {
                    return;
                }
                s.w = probe.naturalWidth;
                s.h = probe.naturalHeight;
                s.gifImage = probe;
                // ใช้ไฟล์ GIF ตรง ๆ (ไม่ผ่าน canvas) ภาพจึงยังขยับระหว่างลากกรอบ
                el.image.onload = function () {
                    s.imageReady = true;
                    startCropper();
                };
                el.image.src = s.url;
            };
            probe.onerror = function () {
                var name = s ? s.file.name : '';
                closeModal();
                onError(fmt(i18n.js_read_fail, { name: name }));
            };
            probe.src = s.url;
        }

        function open(file, kind) {
            teardown();
            s = { file: file, kind: kind, url: URL.createObjectURL(file), w: 0, h: 0, duration: 0 };

            el.title.textContent = kind === 'gif' ? i18n.crop_title_gif : i18n.crop_title;
            el.loading.hidden = false;
            el.editor.hidden = true;
            el.nopreview.hidden = true;
            el.scrubrow.hidden = el.scrubhint.hidden = kind !== 'video';
            el.submit.disabled = true;
            renderPresets();
            updateInfo();

            if (!bsModal) {
                bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
            }
            bsModal.show();

            if (kind === 'gif') {
                openGif();
            } else {
                openVideo();
            }
        }

        function closeModal() {
            if (bsModal) {
                bsModal.hide();
            }
        }

        // ภาพปก = ส่วนที่ครอปของเฟรมที่หยุดไว้ (วิดีโอ) / เฟรมแรก (GIF) เป็น JPEG
        function makePoster(crop, done) {
            var src = s.kind === 'video' ? s.video : s.gifImage;
            if (!src || !crop || crop.mode !== 'rect' || !s.w || !s.h) {
                return done(null);
            }
            var sx = crop.x * s.w, sy = crop.y * s.h, sw = crop.w * s.w, sh = crop.h * s.h;
            var outW = Math.round(Math.min(preset.width, POSTER_MAX_W, Math.max(320, sw)));
            var outH = Math.max(1, Math.round(outW * preset.height / preset.width));
            var c = document.createElement('canvas');
            c.width = outW;
            c.height = outH;
            var ctx = c.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            try {
                ctx.drawImage(src, sx, sy, sw, sh, 0, 0, outW, outH);
                c.toBlob(function (blob) { done(blob); }, 'image/jpeg', 0.85);
            } catch (e) {
                done(null);
            }
        }

        function commit() {
            if (!s) {
                return;
            }
            var crop = s.center ? { mode: 'center' } : currentCrop();
            if (!crop) {
                return;
            }
            crop.preset = preset.key;
            if (s.w && s.h) {
                crop.sw = s.w;
                crop.sh = s.h;
            }
            if (s.video && !s.center) {
                crop.t = Math.round(s.video.currentTime * 1000) / 1000;
            }
            el.submit.disabled = true;

            makePoster(crop, function (blob) {
                if (!s) {
                    return;
                }
                var prev = committed;
                committed = {
                    file: s.file,
                    kind: s.kind,
                    url: s.url,
                    crop: crop,
                    preset: preset,
                    poster: blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null,
                };
                s.keepUrl = true;
                if (prev && prev.url && prev.url !== committed.url) {
                    URL.revokeObjectURL(prev.url);
                }

                cropField.value = JSON.stringify(crop);
                setFiles(posterField, committed.poster ? [committed.poster] : []);
                setFiles(input, [committed.file]);

                showFormPreview({
                    type: committed.kind,
                    src: s.center ? null : committed.url,
                    crop: crop,
                    w: preset.width,
                    h: preset.height,
                });
                markChanged();
                s.committedNow = true;
                closeModal();
            });
        }

        /* ---------------- เลือกไฟล์ ---------------- */

        function problemOf(file, ext, isVideo) {
            var images = '.' + IMAGE_EXTS.join(' .');
            var videos = '.' + videoExts.join(' .');
            if (isVideo && videoExts.indexOf(ext) === -1) {
                return ALL_VIDEO.indexOf(ext) !== -1 && !cfg.ffmpeg
                    ? fmt(i18n.js_need_ffmpeg, { ext: '.' + ext })
                    : fmt(i18n.js_type, { name: file.name, images: images, videos: videos });
            }
            if (!isVideo && IMAGE_EXTS.indexOf(ext) === -1) {
                return fmt(i18n.js_type, { name: file.name, images: images, videos: videos });
            }
            if (isVideo && file.size > maxBytes) {
                return fmt(i18n.js_too_big, { name: file.name, size: (file.size / 1048576).toFixed(1), max: Math.floor(maxBytes / 1048576) });
            }
            return null;
        }

        // ยกเลิก/ไฟล์ใช้ไม่ได้ = คืนไฟล์ที่ยืนยันไว้รอบก่อน (หรือว่าง) ไม่ปล่อยไฟล์ดิบติดไปกับฟอร์ม
        function restore() {
            setFiles(input, committed ? [committed.file] : []);
        }

        form.addEventListener('change', function (e) {
            if (e.target !== input) {
                return;
            }
            var file = input.files && input.files[0];
            if (!file) {
                return;
            }
            var ext = extOf(file.name);
            var isVideo = ALL_VIDEO.indexOf(ext) !== -1 || (/^video\//.test(file.type) && IMAGE_EXTS.indexOf(ext) === -1);

            if (STATIC_EXTS.indexOf(ext) !== -1) {
                // รูปนิ่ง - ให้กล่องตัดรูป/ตัวอย่างเดิมทำงาน และล้างข้อมูลวิดีโอที่ค้างอยู่
                committed = null;
                cropField.value = '';
                setFiles(posterField, []);
                clearFormPreview();
                return;
            }

            // วิดีโอ / GIF / ไฟล์ที่ไม่รองรับ - ไม่ให้ไปถึงตัวตัดรูปเดิม
            e.stopImmediatePropagation();

            var problem = problemOf(file, ext, isVideo);
            if (problem) {
                restore();
                onError(problem);
                return;
            }

            if (typeof window.Cropper !== 'function' || !window.bootstrap) {
                // เครื่องมือครอปโหลดไม่ขึ้น - ส่งไฟล์ตามต้นฉบับ (เซิร์ฟเวอร์/หน้าเว็บครอปกึ่งกลางให้)
                cropField.value = JSON.stringify({ mode: 'center', preset: preset.key });
                setFiles(posterField, []);
                committed = { file: file, kind: ext === 'gif' ? 'gif' : 'video', url: null, crop: { mode: 'center' } };
                onError(i18n.js_no_lib);
                return;
            }

            open(file, ext === 'gif' ? 'gif' : 'video');
        }, true);

        el.scrub.addEventListener('input', function () {
            if (s && s.video && !s.fixing) {
                s.video.currentTime = parseFloat(el.scrub.value) || 0;
            }
        });

        el.play.addEventListener('click', function () {
            var v = s && s.previewMedia && s.previewMedia.tagName === 'VIDEO' ? s.previewMedia : null;
            if (!v) {
                return;
            }
            if (v.paused) {
                var p = v.play();
                if (p && p.catch) { p.catch(function () {}); }
            } else {
                v.pause();
            }
            setTimeout(setPlayIcon, 50);
        });

        el.submit.addEventListener('click', commit);

        modal.addEventListener('shown.bs.modal', function () {
            modalShown = true;
            startCropper();
        });

        modal.addEventListener('hidden.bs.modal', function () {
            modalShown = false;
            if (s && !s.committedNow) {
                restore();
            }
            teardown();
            el.loading.hidden = true;
        });

        // แบนเนอร์เดิมที่เป็นวิดีโอ/GIF - แสดงตัวอย่างที่เล่นได้ในกล่องเดิมของฟอร์ม
        var cur = opt.current;
        if (cur && (cur.type === 'video' || cur.type === 'gif')) {
            var c = cur.crop ? { mode: 'rect', x: cur.crop.x, y: cur.crop.y, w: cur.crop.w, h: cur.crop.h } : null;
            showFormPreview({
                type: cur.type,
                src: cur.type === 'video' ? cur.video_url : cur.image_url,
                poster: cur.poster_url,
                crop: c,
                w: cur.width || preset.width,
                h: cur.height || preset.height,
            });
        }
    }

    return { attach: attach };
})();
