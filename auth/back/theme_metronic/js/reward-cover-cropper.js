/**
 * กล่องตัดรูปปกของรางวัล (ใช้กับ modal อัปโหลดรูปในหน้า admin/reward/{id}/edit)
 *
 * ── ทำไมต้องมี ──
 * หน้าเว็บฝั่งผู้ใช้ตรึงกรอบรูปปกไว้ที่สัดส่วนเดียว (ดู .rw-media / .rw-card-media ใน
 * public/front/css/reward.css) รูปที่สัดส่วนไม่ตรงจะโดน object-fit:cover ครอบตัดให้เอง
 * ที่กึ่งกลางเสมอ คนอัปโหลดไม่มีทางรู้ล่วงหน้าว่าหัว/ขอบของสินค้าจะหายไปหรือเปล่า
 * ตัวนี้จึงให้เลือกกรอบเองก่อน แล้วส่งไฟล์ที่ตัดเสร็จ "ขนาดตรงเป๊ะ" ไปให้เซิร์ฟเวอร์
 *
 * ── เรื่องขนาดไฟล์ ──
 * ไม่มีการห้ามไฟล์ใหญ่ ผู้ใช้ลากรูปจากมือถือ/กล้องมาวางได้เลยไม่ต้องไปย่อเองก่อน
 * ตัวนี้ย่อรูปให้อัตโนมัติก่อนเอาไปให้ลากกรอบ และผลลัพธ์ที่อัปโหลดจริงมีแค่ขนาดปก
 * (356x293 ราว ๆ 30-60KB) ไม่ว่าต้นฉบับจะใหญ่แค่ไหน
 *
 * ── ขอบเขตของไฟล์นี้ ──
 * รู้จักแค่ DOM กับ Cropper.js เท่านั้น ไม่รู้จัก route/CSRF/รูปแบบ response ของ Laravel
 * เสร็จแล้วส่ง File กลับทาง onCropped() ให้ฝั่งที่เรียกเป็นคนอัปโหลดเอง
 * (แยกแบบนี้เพื่อให้เอาไปใช้กับจุดอัปโหลดอื่นที่ต้องการสัดส่วนคงที่ได้โดยไม่ต้องแก้อะไร)
 *
 * ใช้งาน:
 *   RewardCoverCropper.init({
 *       modal: '#modal_reward_gallery',
 *       width: 356, height: 293,
 *       onCropped: function (file, api) { ... },
 *       onError:   function (msg)       { ... },
 *   });
 */
window.RewardCoverCropper = (function () {
    'use strict';

    var ACCEPTED = ['image/jpeg', 'image/png'];

    // ด้านที่ยาวที่สุดของรูปที่เอาไปให้ผู้ใช้ลากกรอบ รูปที่ใหญ่กว่านี้ถูกย่อลงก่อน
    // ผลลัพธ์สุดท้ายมีแค่ 356x293 การแบกรูป 6000px ไว้ทั้งใบจึงไม่ได้คุณภาพเพิ่มเลย
    // มีแต่ทำให้เบราว์เซอร์หน่วง (รูปมือถือ 12 ล้านพิกเซล = ~48MB ในหน่วยความจำ)
    var MAX_WORK_PX = 2000;

    var JPEG_QUALITY = 0.92;

    function init(options) {
        var modal = document.querySelector(options.modal);
        if (!modal) {
            return null;
        }

        // ทุก element อยู่ใน modal เดียวกันหมด หาให้ครบครั้งเดียวตอน init
        var fileInput = modal.querySelector('[data-crop="file"]');
        var image     = modal.querySelector('[data-crop="image"]');
        var submitBtn = modal.querySelector('[data-crop="submit"]');
        var backBtn   = modal.querySelector('[data-crop="back"]');
        var loading   = modal.querySelector('[data-crop="loading"]'); // มีก็ได้ ไม่มีก็ได้
        var preview   = modal.querySelector('[data-crop="preview"]'); // มีก็ได้ ไม่มีก็ได้

        // ถ้า markup ไม่ครบ ให้ดังตั้งแต่ตอนโหลดหน้า ดีกว่าปล่อยให้ผู้ใช้กดแล้วเงียบ
        if (!fileInput || !image || !submitBtn || !backBtn) {
            console.error('[RewardCoverCropper] markup ของ modal ไม่ครบ (ต้องมี data-crop="file|image|submit|back")');
            return null;
        }

        var width     = options.width;
        var height    = options.height;
        var onCropped = options.onCropped || function () {};
        var onError   = options.onError || function (msg) { window.alert(msg); };

        var cropper    = null;
        var reader     = null;
        var outputType = 'image/jpeg';

        // สร้าง api ไว้ตั้งแต่ต้น แล้วส่งตัวมันเองกลับไปกับ onCropped() ด้วย
        // ฝั่งที่เรียกจึงคุมปุ่ม (setBusy/reset) ได้โดยไม่ต้องพึ่งตัวแปรที่ init() คืนให้
        // ซึ่งตอน onCropped ถูกกำหนดยังไม่มีค่า - เป็นลำดับที่ถูกวันนี้แต่พังง่ายวันหน้า
        var api = {
            reset: function () { reset(); },
            setBusy: function (busy) { setBusy(busy); },
        };

        /* ---------------------------------------------------------------- */

        // ทุกทางที่ออกจากขั้นตอนตัดภาพต้องผ่านตัวนี้ที่เดียว ไม่งั้นจะลืม destroy()
        // แล้ว Cropper ตัวเก่ายังผูกอยู่กับ <img> เดิม (กินหน่วยความจำ และรอบหน้า
        // จะได้กรอบค้างของรูปก่อนหน้า) หรือลืมยกเลิกการอ่านไฟล์ที่ยังค้างอยู่
        function teardown() {
            if (reader) {
                reader.onload = reader.onerror = null;
                reader.abort();
                reader = null;
            }
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            image.onload = image.onerror = null;
            image.removeAttribute('src');
        }

        function showStep(step) {
            var panes = modal.querySelectorAll('[data-crop-step]');
            for (var i = 0; i < panes.length; i++) {
                panes[i].hidden = panes[i].getAttribute('data-crop-step') !== step;
            }
        }

        // ไฟล์ใหญ่ ๆ ใช้เวลาอ่านและถอดรหัสอยู่พักหนึ่ง ถ้าไม่บอกอะไรเลยผู้ใช้จะนึกว่าค้าง
        // แล้วกดเลือกไฟล์ซ้ำ ๆ ระหว่างนั้นด้วย - ปิดช่องเลือกไฟล์ไว้ก่อนกันงานซ้อนกัน
        function setLoading(busy) {
            fileInput.disabled = busy;
            if (loading) {
                loading.hidden = !busy;
            }
        }

        function reset() {
            teardown();
            fileInput.value = '';
            setLoading(false);
            setBusy(false);
            showStep('pick');
        }

        function setBusy(busy) {
            submitBtn.disabled = busy;
            submitBtn.innerHTML = busy
                ? '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลด...'
                : '<i class="fa-solid fa-crop-simple"></i> ตัดภาพและอัปโหลด';
        }

        function fail(message) {
            reset();
            onError(message);
        }

        /**
         * ตรวจว่าไฟล์ที่เลือกมาเป็นรูปชนิดที่รับได้ไหม
         *
         * ข้อความบอกชื่อไฟล์กับสกุลที่เลือกมาด้วย เพราะกล่องเลือกไฟล์ของ OS ให้สลับ
         * ไปเป็น "All files" ได้เสมอ ต่อให้ตั้ง accept ไว้แล้วก็ตาม คนที่เลือกผิด
         * มักเลือกจากโฟลเดอร์ที่มีไฟล์ชื่อคล้ายกันหลายอัน บอกชื่อไปด้วยจะหาเจอเร็วกว่า
         */
        function validate(file) {
            if (ACCEPTED.indexOf(file.type) !== -1) {
                return null;
            }

            var dot  = file.name.lastIndexOf('.');
            var kind = dot > -1 ? file.name.slice(dot).toLowerCase() : (file.type || 'ไม่ทราบชนิดไฟล์');

            return 'ไฟล์ "' + file.name + '" เป็น ' + kind + ' ซึ่งใช้เป็นรูปปกไม่ได้ '
                 + 'รองรับเฉพาะไฟล์รูปภาพ .jpg, .jpeg และ .png เท่านั้น';
        }

        /**
         * ย่อ/แปลงรูปต้นฉบับให้อยู่ในขนาดที่ทำงานสะดวก ก่อนส่งให้ Cropper
         *
         * วาดผ่าน canvas ทุกครั้ง ไม่ใช่เฉพาะตอนรูปใหญ่ เพราะได้ผลพลอยได้สองอย่าง
         *  - EXIF ถูกตัดทิ้ง รูปจากมือถือจึงไม่มีทางตะแคงจากการหมุนซ้ำสองรอบ
         *    (เบราว์เซอร์หมุนให้ตั้งแต่ตอนถอดรหัสอยู่แล้ว ถ้า Cropper อ่าน EXIF หมุนอีก
         *    ก็จะเกินไปหนึ่งรอบ - จึงปิด checkOrientation ไปเลย ดูตอนสร้าง Cropper)
         *  - เส้นทางเดียวเสมอ ไม่มีเคส "รูปเล็กเดินอีกทาง" ที่จะแอบพังเฉพาะบางไฟล์
         */
        function normalize(probe) {
            var longest = Math.max(probe.naturalWidth, probe.naturalHeight);
            var scale   = Math.min(1, MAX_WORK_PX / longest);

            var canvas = document.createElement('canvas');
            canvas.width  = Math.max(1, Math.round(probe.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(probe.naturalHeight * scale));

            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);

            return canvas.toDataURL(outputType, JPEG_QUALITY);
        }

        function startCropper() {
            var settings = {
                aspectRatio: width / height,
                viewMode: 1,        // กรอบตัดออกนอกรูปไม่ได้ - กันขอบขาวติดไปในไฟล์
                autoCropArea: 1,    // เริ่มด้วยกรอบใหญ่ที่สุดที่ยังได้สัดส่วนนี้
                background: false,
                responsive: true,
                checkOrientation: false, // normalize() ตัด EXIF ทิ้งไปแล้ว ไม่ต้องหมุนซ้ำ
            };

            // ช่องพรีวิวมีก็ต่อเมื่อ markup ใส่มาให้ - Cropper จะสะท้อนกรอบที่เลือก
            // ลงในช่องนี้แบบเรียลไทม์ ผู้ใช้จึงเห็นผลจริงก่อนกดอัปโหลด
            if (preview) {
                settings.preview = preview;
            }

            cropper = new window.Cropper(image, settings);
            showStep('crop');
        }

        /* ---------------------------------------------------------------- */

        fileInput.addEventListener('change', function () {
            var file = fileInput.files && fileInput.files[0];
            if (!file) {
                return;
            }

            var problem = validate(file);
            if (problem) {
                fail(problem);
                return;
            }

            if (typeof window.Cropper !== 'function') {
                fail('โหลดเครื่องมือตัดภาพไม่สำเร็จ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่');
                return;
            }

            // png ที่มีพื้นหลังโปร่งต้องออกเป็น png ต่อ ไม่งั้นพื้นโปร่งจะกลายเป็นสีดำ
            // ตอนแปลงเป็น jpeg (jpeg ไม่มีช่อง alpha)
            outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

            teardown();
            setLoading(true);

            // ── ทำไมใช้ FileReader (data: URL) ไม่ใช่ URL.createObjectURL (blob: URL) ──
            // CSP ของระบบตั้ง img-src ไว้ว่า 'self' data: https: <belib> (ดู SecurityHeaders)
            // ซึ่งไม่มี blob: อยู่ในลิสต์ เบราว์เซอร์จึงบล็อกรูปที่มาจาก blob: ทิ้งทั้งหมด
            // ตัวตัดภาพจะได้กรอบเปล่า ๆ ตลอด เลือกอ่านเป็น data: ที่ CSP อนุญาตอยู่แล้ว
            // ดีกว่าไปเปิด CSP ให้กว้างขึ้นเพื่อฟีเจอร์เดียว
            reader = new FileReader();

            reader.onerror = function () {
                fail('อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่');
            };

            reader.onload = function (e) {
                // ถอดรหัสรูปในตัวแปรลอย ๆ ก่อน เพื่อรู้ขนาดจริงแล้วย่อให้เรียบร้อย
                // ค่อยยัดผลลัพธ์เข้า <img> ที่ Cropper จะเกาะ - <img> จึงถูกตั้ง src
                // ครั้งเดียว ไม่มีจังหวะที่ onload ยิงสองรอบจนสร้าง Cropper ซ้อนกัน
                var probe = new Image();

                probe.onerror = function () {
                    fail('เปิดไฟล์ "' + file.name + '" ไม่สำเร็จ ไฟล์อาจเสียหายหรือไม่ใช่รูปภาพจริง');
                };

                probe.onload = function () {
                    image.onload = function () {
                        setLoading(false);
                        startCropper();
                    };
                    image.onerror = function () {
                        fail('แสดงรูปไม่สำเร็จ กรุณาลองใหม่');
                    };
                    image.src = normalize(probe);
                };

                probe.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });

        backBtn.addEventListener('click', function () {
            reset();
        });

        submitBtn.addEventListener('click', function () {
            if (!cropper) {
                onError('ยังไม่ได้เลือกรูป');
                return;
            }

            var canvas = cropper.getCroppedCanvas({
                width: width,
                height: height,
                imageSmoothingQuality: 'high',
                fillColor: '#fff', // กันพื้นโปร่งกลายเป็นดำเวลาบันทึกเป็น jpeg
            });

            if (!canvas) {
                onError('ตัดภาพไม่สำเร็จ กรุณาลองใหม่');
                return;
            }

            setBusy(true);

            canvas.toBlob(function (blob) {
                // toBlob คืน null ได้ถ้าเบราว์เซอร์ไม่รองรับชนิดไฟล์ที่ขอ
                // ถ้าไม่เช็ค จะกลายเป็นอัปโหลดไฟล์เปล่าแบบไม่มีใครรู้
                if (!blob) {
                    setBusy(false);
                    onError('แปลงรูปไม่สำเร็จ กรุณาลองใหม่');
                    return;
                }

                var name = outputType === 'image/png' ? 'cover.png' : 'cover.jpg';
                onCropped(new File([blob], name, { type: outputType }), api);
            }, outputType, JPEG_QUALITY);
        });

        // ปิด modal ตอนไหนก็ตาม (กากบาท, ปุ่ม Close, กด Esc, คลิกพื้นหลัง) ต้องล้างให้หมด
        modal.addEventListener('hidden.bs.modal', reset);

        return api;
    }

    return { init: init };
})();
