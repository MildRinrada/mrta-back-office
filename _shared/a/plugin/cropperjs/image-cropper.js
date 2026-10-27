/**
 * กล่องตัดรูป (crop modal) สำหรับช่องอัปโหลดรูปที่ต้องได้ขนาดตายตัว
 *
 * ── ทำไมต้องมี ──
 * หน้าเว็บฝั่งผู้ใช้ตรึงกรอบรูปไว้ที่สัดส่วนเดียวทุกจุด (avatar เป็นวงกลม, การ์ด
 * ทรัพยากร, ปกบทความ, แบนเนอร์) รูปที่สัดส่วนไม่ตรงจะโดน object-fit:cover ครอบตัด
 * ให้เองที่กึ่งกลางเสมอ คนอัปโหลดไม่มีทางรู้ล่วงหน้าว่าหัวคนหรือขอบภาพจะหายไปไหม
 * ตัวนี้จึงให้เลือกกรอบเองก่อน แล้วค่อยส่งไฟล์ที่ตัดเสร็จ "ขนาดตรงเป๊ะ" ไปกับฟอร์ม
 *
 * ── เรื่องขนาดไฟล์ ──
 * ไม่ห้ามไฟล์ใหญ่ ผู้ใช้ลากรูปจากมือถือ/กล้องมาวางได้เลยไม่ต้องย่อเองก่อน ตัวนี้ย่อ
 * ให้อัตโนมัติก่อนเอาไปให้ลากกรอบ และไฟล์ที่ถูกส่งจริงมีแค่ขนาดที่กำหนดไว้เท่านั้น
 * ไม่ว่าต้นฉบับจะใหญ่แค่ไหน
 *
 * ── ต่างจากของฝั่ง mrta-auth (reward-cover-cropper.js) ตรงไหน ──
 * ของนั้นช่องเลือกไฟล์อยู่ใน modal และอัปโหลดเองผ่าน ajax
 * ของนี้ช่องเลือกไฟล์เป็น <input type="file"> ของฟอร์มเดิมที่มีอยู่แล้ว modal แค่มา
 * คั่นกลาง แล้วเขียนไฟล์ที่ตัดเสร็จกลับเข้า input ตัวเดิม ฟอร์มจึง submit ตามปกติ
 * ไม่ต้องแก้ controller และถ้าวันหน้าเอา modal ออก ฟอร์มก็ยังทำงานได้เหมือนเดิม
 *
 * ── ถ้าไลบรารีโหลดไม่ขึ้น ──
 * ปล่อยไฟล์ต้นฉบับไว้ใน input ตามเดิม (แค่เตือน) ดีกว่าล็อกไม่ให้อัปโหลดอะไรได้เลย
 *
 * ใช้งาน:
 *   ImageCropper.attach({
 *       input:   '#avatar_file_input',   // input ของฟอร์ม (จำเป็น)
 *       modal:   '#modal_crop_avatar',   // markup จาก shared/image_crop_modal (จำเป็น)
 *       width:   512, height: 512,       // ขนาดไฟล์ผลลัพธ์ (จำเป็น)
 *       preview: '#avatar_preview',      // <img> ที่จะอัปเดตหลังตัดเสร็จ (จะใส่หรือไม่ก็ได้)
 *       onError:   function (msg) {},    // ค่าเริ่มต้นใช้ Swal ถ้ามี ไม่งั้น alert()
 *   });
 */
window.ImageCropper = (function () {
    'use strict';

    // BMP รับได้ (TOR 3.5.2) - ตัดแล้วออกเป็น jpeg เสมอ ฝั่ง server จึงได้ jpg/png เหมือนเดิม
    var ACCEPTED = ['image/jpeg', 'image/png', 'image/bmp', 'image/x-ms-bmp'];

    // ด้านที่ยาวที่สุดของรูปที่เอาไปให้ผู้ใช้ลากกรอบ รูปที่ใหญ่กว่านี้ถูกย่อลงก่อน
    // ผลลัพธ์สุดท้ายมีขนาดจำกัดอยู่แล้ว การแบกรูป 6000px ไว้ทั้งใบจึงไม่ได้คุณภาพเพิ่ม
    // มีแต่ทำให้เบราว์เซอร์หน่วง (รูปมือถือ 12 ล้านพิกเซล = ~48MB ในหน่วยความจำ)
    var MAX_WORK_PX = 2000;

    var JPEG_QUALITY = 0.92;

    function defaultError(msg) {
        if (window.Swal) {
            window.Swal.fire({ icon: 'warning', text: msg, confirmButtonText: 'ตกลง' });
        } else {
            window.alert(msg);
        }
    }

    function attach(options) {
        var input = document.querySelector(options.input);
        var modal = document.querySelector(options.modal);

        // ไม่มี element ก็ไม่ต้องทำอะไร - หน้าเดียวกันถูกใช้ทั้งโหมดสร้างและแก้ไข
        // บางโหมดอาจไม่มีช่องอัปโหลด การ return เงียบ ๆ ถูกต้องกว่าการ throw
        if (!input || !modal) {
            return;
        }

        var image     = modal.querySelector('[data-crop="image"]');
        var submitBtn = modal.querySelector('[data-crop="submit"]');
        var loading   = modal.querySelector('[data-crop="loading"]');
        var preview   = modal.querySelector('[data-crop="preview"]');

        // markup ไม่ครบให้ดังตั้งแต่โหลดหน้า ดีกว่าปล่อยให้ผู้ใช้กดแล้วเงียบ
        if (!image || !submitBtn) {
            console.error('[ImageCropper] markup ของ modal ไม่ครบ (ต้องมี data-crop="image" และ data-crop="submit")');
            return;
        }

        var width     = options.width;
        var height    = options.height;
        var previewEl = options.preview ? document.querySelector(options.preview) : null;
        var onError   = options.onError || defaultError;

        var bsModal    = null;
        var cropper    = null;
        var reader     = null;
        var outputType = 'image/jpeg';

        // ไฟล์ที่ "ตัดเสร็จแล้ว" จากรอบก่อน ถ้ารอบนี้ปิด modal ทิ้งกลางคันต้องคืนค่านี้
        // กลับเข้า input ไม่งั้นรูปที่อุตส่าห์ตัดไว้รอบก่อนจะหายไปเงียบ ๆ
        var croppedFiles = null;

        // ผู้ใช้กดตัดสำเร็จในรอบนี้หรือยัง - ใช้แยกว่าตอน modal ปิดควรคืนไฟล์เดิมไหม
        var committed = false;

        // Cropper วัดขนาดกรอบจาก .imgc-stage ตอนสร้าง ถ้าสร้างตอน modal ยัง display:none
        // (bootstrap ใช้เวลาเปิดราว 300ms) มันจะวัดได้ศูนย์ แล้ววางกรอบเล็กจิ๋วอยู่มุมบนซ้าย
        // จึงต้องรอให้ครบทั้งสองอย่าง: modal เปิดสุดแล้ว และรูปโหลดเสร็จแล้ว
        var modalShown = false;
        var imageReady = false;

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
            imageReady = false;
            image.onload = image.onerror = null;
            image.removeAttribute('src');
        }

        function setLoading(busy) {
            if (loading) {
                loading.hidden = !busy;
            }
        }

        function setBusy(busy) {
            submitBtn.disabled = busy;
        }

        // ใส่ไฟล์กลับเข้า <input type="file"> ผ่าน DataTransfer
        // (input.files เขียนตรง ๆ ไม่ได้ ต้องผ่าน FileList ที่ DataTransfer สร้างให้)
        function setInputFiles(files) {
            var dt = new DataTransfer();
            if (files) {
                for (var i = 0; i < files.length; i++) {
                    dt.items.add(files[i]);
                }
            }
            input.files = dt.files;
        }

        function closeModal() {
            if (bsModal) {
                bsModal.hide();
            }
        }

        function fail(message) {
            closeModal();
            onError(message);
        }

        /**
         * ตรวจว่าไฟล์ที่เลือกมาเป็นรูปชนิดที่รับได้ไหม
         *
         * ข้อความบอกชื่อไฟล์กับสกุลที่เลือกมาด้วย เพราะกล่องเลือกไฟล์ของ OS ให้สลับ
         * ไปเป็น "All files" ได้เสมอ ต่อให้ตั้ง accept ไว้แล้วก็ตาม
         */
        function validate(file) {
            if (ACCEPTED.indexOf(file.type) !== -1) {
                return null;
            }

            var dot  = file.name.lastIndexOf('.');
            var kind = dot > -1 ? file.name.slice(dot).toLowerCase() : (file.type || 'ไม่ทราบชนิดไฟล์');

            return 'ไฟล์ "' + file.name + '" เป็น ' + kind + ' ซึ่งใช้เป็นรูปไม่ได้ '
                 + 'รองรับเฉพาะไฟล์รูปภาพ .jpg, .jpeg, .png และ .bmp เท่านั้น';
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

            if (preview) {
                settings.preview = preview;
            }

            cropper = new window.Cropper(image, settings);
            setBusy(false);
        }

        // สร้าง Cropper เมื่อพร้อมครบทั้งสองฝั่ง ไม่ว่าอันไหนจะเสร็จก่อน
        // (ไฟล์เล็กอ่านเสร็จก่อน modal เปิด ไฟล์ใหญ่กลับกัน)
        function startWhenReady() {
            if (modalShown && imageReady && !cropper) {
                startCropper();
            }
        }

        /* ---------------------------------------------------------------- */

        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            if (!file) {
                return;
            }

            // ไลบรารีโหลดไม่ขึ้น - ปล่อยไฟล์ต้นฉบับผ่านไปตามเดิม ระบบยังใช้งานได้
            // (รูปจะโดน object-fit ครอบตัดเอาเองเหมือนก่อนมี modal นี้)
            if (typeof window.Cropper !== 'function' || typeof window.bootstrap === 'undefined') {
                onError('โหลดเครื่องมือตัดภาพไม่สำเร็จ ระบบจะอัปโหลดรูปตามต้นฉบับ '
                      + 'หากต้องการเลือกกรอบเอง กรุณารีเฟรชหน้าเว็บแล้วลองใหม่');
                return;
            }

            var problem = validate(file);
            if (problem) {
                setInputFiles(croppedFiles);
                onError(problem);
                return;
            }

            // png ที่มีพื้นหลังโปร่งต้องออกเป็น png ต่อ ไม่งั้นพื้นโปร่งจะกลายเป็นสีดำ
            // ตอนแปลงเป็น jpeg (jpeg ไม่มีช่อง alpha)
            outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

            committed = false;
            teardown();
            setBusy(true);
            setLoading(true);

            if (!bsModal) {
                bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
            }
            bsModal.show();

            // ── ทำไมใช้ FileReader (data: URL) ไม่ใช่ URL.createObjectURL (blob: URL) ──
            // ทั้งสองแบบใช้ได้กับ CSP ของระบบนี้ แต่ data: เดินทางเดียวกับตอน normalize()
            // ที่ต้องแปลงผ่าน canvas อยู่แล้ว จึงไม่ต้องมี revokeObjectURL ให้ลืม
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
                        imageReady = true;
                        startWhenReady();
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

        submitBtn.addEventListener('click', function () {
            if (!cropper) {
                return;
            }

            var canvas = cropper.getCroppedCanvas({
                width: width,
                height: height,
                imageSmoothingQuality: 'high',
                fillColor: '#fff', // กันพื้นโปร่งกลายเป็นดำเวลาบันทึกเป็น jpeg
            });

            if (!canvas) {
                fail('ตัดภาพไม่สำเร็จ กรุณาลองใหม่');
                return;
            }

            setBusy(true);

            canvas.toBlob(function (blob) {
                // toBlob คืน null ได้ถ้าเบราว์เซอร์ไม่รองรับชนิดไฟล์ที่ขอ
                // ถ้าไม่เช็ค จะกลายเป็นอัปโหลดไฟล์เปล่าแบบไม่มีใครรู้
                if (!blob) {
                    fail('แปลงรูปไม่สำเร็จ กรุณาลองใหม่');
                    return;
                }

                var ext  = outputType === 'image/png' ? '.png' : '.jpg';
                var name = (input.name || 'image').replace(/[^A-Za-z0-9_-]/g, '') + ext;

                setInputFiles([new File([blob], name, { type: outputType })]);
                croppedFiles = input.files;
                committed    = true;

                if (previewEl) {
                    previewEl.src = canvas.toDataURL(outputType, JPEG_QUALITY);
                }

                closeModal();
            }, outputType, JPEG_QUALITY);
        });

        modal.addEventListener('shown.bs.modal', function () {
            modalShown = true;
            startWhenReady();
        });

        // ปิด modal ตอนไหนก็ตาม (กากบาท, ปุ่มยกเลิก, กด Esc, คลิกพื้นหลัง)
        modal.addEventListener('hidden.bs.modal', function () {
            modalShown = false;
            // ยกเลิกกลางคัน - ตอนนี้ input ยังถือ "ไฟล์ดิบที่ยังไม่ได้ตัด" อยู่
            // ถ้าปล่อยไว้ ฟอร์มจะ submit รูปที่ไม่ได้ผ่านการตัดไปแบบเงียบ ๆ
            // จึงคืนไฟล์ที่ตัดสำเร็จไว้รอบก่อน (หรือว่าง ถ้ายังไม่เคยตัดสำเร็จเลย)
            if (!committed) {
                setInputFiles(croppedFiles);
            }
            teardown();
            setLoading(false);
            setBusy(false);
        });
    }

    return { attach: attach };
})();
