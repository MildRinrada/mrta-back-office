<?php
/**
 * ตารางแทนข้อมูลส่วนบุคคลจริง → ข้อมูลสมมติ สำหรับเว็บทดลอง (build.py ใช้แทนทุกหน้า/ทุกไฟล์ข้อมูล)
 * อ่านอย่างเดียว ไม่เขียนฐานข้อมูล - ผลลัพธ์มีข้อมูลจริง เก็บไว้ใน scratchpad เท่านั้น ห้ามใส่ในโฟลเดอร์ที่ deploy
 *
 * ใช้: php pii_dict.php <portal app dir> <out.json>
 */

[$_, $dir, $outFile] = $argv;
chdir($dir);
require $dir . '/vendor/autoload.php';
$app = require $dir . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Support\Pii;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$TH_FIRST = ['สมชาย', 'สมหญิง', 'วิภาวดี', 'ณัฐพล', 'กิตติพงษ์', 'ปิยะนุช', 'ธีรภัทร', 'อรอุมา', 'ศิริพร', 'ชยพล', 'พิมพ์ชนก', 'ภาณุวัฒน์',
    'กมลชนก', 'ธีรวัฒน์', 'นภัสสร', 'วรเชษฐ์', 'สุภาวดี', 'อนุชา', 'จิราพร', 'พงศกร', 'รัตนาภรณ์', 'เกียรติศักดิ์', 'ปวีณา', 'ชนาธิป',
    'ศุภชัย', 'มณีรัตน์', 'ประเสริฐ', 'วนิดา', 'ธนพร', 'อภิชาติ', 'กัญญารัตน์', 'สุริยา'];
$TH_LAST = ['ใจดี', 'รักเรียน', 'มั่นคง', 'ศรีสุข', 'สายทอง', 'บุญมา', 'แก้วประเสริฐ', 'วงศ์ไทย', 'ทองดี', 'เรืองศรี', 'พรหมมา', 'ชัยมงคล',
    'สุขสวัสดิ์', 'นาคประเสริฐ', 'ศรีวงศ์', 'บุญเรือง', 'จันทร์หอม', 'ทองคำ', 'แสงอรุณ', 'พูลสวัสดิ์', 'อินทร์แก้ว', 'ประจำวงศ์',
    'มีสุข', 'เพชรรัตน์', 'วัฒนกุล', 'ศักดิ์ดี', 'ธรรมรักษ์', 'สมบูรณ์ชัย', 'กาญจนวงศ์', 'ปัญญาดี', 'ศรีเมือง', 'ทรัพย์มาก'];
$EN_FIRST = ['Somchai', 'Somying', 'Wipawadee', 'Nattapon', 'Kittipong', 'Piyanuch', 'Teerapat', 'Onuma', 'Siriporn', 'Chayapon', 'Pimchanok',
    'Panuwat', 'Kamonchanok', 'Teerawat', 'Napatsorn', 'Worachet', 'Supawadee', 'Anucha', 'Jiraporn', 'Pongsakorn', 'Rattanaporn',
    'Kiattisak', 'Paweena', 'Chanatip', 'Suppachai', 'Maneerat', 'Prasert', 'Wanida', 'Thanaporn', 'Apichat', 'Kanyarat', 'Suriya'];
$EN_LAST = ['Jaidee', 'Rakrian', 'Mankong', 'Srisuk', 'Saithong', 'Boonma', 'Kaewprasert', 'Wongthai', 'Thongdee', 'Ruangsri', 'Prommma',
    'Chaimongkol', 'Suksawat', 'Nakprasert', 'Sriwong', 'Boonruang', 'Janhom', 'Thongkham', 'Saengarun', 'Poonsawat', 'Inkaew',
    'Prajamwong', 'Meesuk', 'Petcharat', 'Wattanakul', 'Sakdee', 'Thammarak', 'Somboonchai', 'Kanjanawong', 'Panyadee', 'Srimuang', 'Sapmak'];

$pairs = [];   // real => fake
$types = [];   // real => type (สำหรับทำค่าที่ปิดบัง)
$avatars = [];
$allow = [];   // อีเมล/เบอร์ขององค์กร ไม่ต้องแทน

$isThai = fn ($s) => (bool) preg_match('/\p{Thai}/u', $s);
$h = fn ($s, $n) => hexdec(substr(md5($s), 0, 8)) % $n;

$add = function ($real, $fake, $type) use (&$pairs, &$types) {
    $real = trim((string) $real);
    if ($real === '' || $real === '-' || mb_strlen($real) < 2 || isset($pairs[$real])) {
        return;
    }
    $pairs[$real] = $fake;
    $types[$real] = $type;
};

$fakeDigits = function (string $real, string $seed, int $keep = 2) {
    // เก็บรูปแบบ (ขีด/เว้นวรรค) และหลักแรก ๆ ไว้ เปลี่ยนตัวเลขที่เหลือ
    $out = '';
    $i = 0;
    $hash = md5('d' . $seed);
    foreach (mb_str_split($real) as $ch) {
        if (ctype_digit($ch)) {
            $out .= $i < $keep ? $ch : (string) (hexdec($hash[$i % 32]) % 10);
            $i++;
        } else {
            $out .= $ch;
        }
    }

    return $out;
};

$fakeId = function (string $real, string $seed) {
    $hash = md5('id' . $seed);
    $d = '1';
    for ($i = 1; $i < 12; $i++) {
        $d .= (string) (hexdec($hash[$i]) % 10);
    }
    $sum = 0;
    for ($i = 0; $i < 12; $i++) {
        $sum += (int) $d[$i] * (13 - $i);
    }
    $d .= (string) ((11 - $sum % 11) % 10);
    if (str_contains($real, '-')) {
        return $d[0] . '-' . substr($d, 1, 4) . '-' . substr($d, 5, 5) . '-' . substr($d, 10, 2) . '-' . $d[12];
    }

    return $d;
};

$personName = function (string $first, string $last, string $seed) use ($TH_FIRST, $TH_LAST, $EN_FIRST, $EN_LAST, $h, $isThai) {
    $i = $h('f' . $seed, count($TH_FIRST));
    $j = $h('l' . $seed, count($TH_LAST));
    $th = $isThai($first . $last) || ($first === '' && $last === '');

    return [$th ? $TH_FIRST[$i] : $EN_FIRST[$i], $th ? $TH_LAST[$j] : $EN_LAST[$j], $EN_FIRST[$i], $EN_LAST[$j]];
};

$fakeEmail = function (string $real, string $enFirst, string $enLast, string $seed) use ($h) {
    return strtolower($enFirst) . '.' . strtolower(substr($enLast, 0, 1)) . ($h('e' . $seed, 90) + 10) . '@example.com';
};

// ---- ผู้ใช้
foreach (DB::table('users')->orderBy('id')->get() as $row) {
    $u = App\Models\User::withoutGlobalScopes()->find($row->id);
    if (! $u) {
        continue;
    }
    $seed = 'u' . $u->id;
    $first = (string) $u->name;
    $last = (string) $u->last_name;
    [$fFirst, $fLast, $enFirst, $enLast] = $personName($first, $last, $seed);
    $add($first, $fFirst, 'name');
    $add($last, $fLast, 'name');
    if ($first !== '' && $last !== '') {
        $add($first . ' ' . $last, $fFirst . ' ' . $fLast, 'name');
    }
    try {
        $display = (string) $u->display_name;
    } catch (Throwable $e) {
        $display = '';
    }
    if ($display !== '' && ! isset($pairs[$display])) {
        $add($display, $fFirst . ' ' . $fLast, 'name');
    }
    $email = (string) $u->email;
    $fakeMail = $fakeEmail($email, $enFirst, $enLast, $seed);
    $add($email, $fakeMail, 'email');
    if ($u->username && $u->username !== $email) {
        $add($u->username, str_contains($u->username, '@') ? $fakeMail : strtolower($enFirst) . '.' . strtolower(substr($enLast, 0, 1)), 'text');
    }
    if ($u->contact_number) {
        $add($u->contact_number, $fakeDigits($u->contact_number, $seed), 'phone');
    }
    if ($u->birthday) {
        $b = (string) $u->birthday;
        $fakeB = date('Y-m-d', strtotime(substr($b, 0, 10)) + 86400 * (37 + $h('b' . $seed, 300)));
        $add(substr($b, 0, 10), $fakeB, 'text');
        $add(date('d/m/Y', strtotime(substr($b, 0, 10))), date('d/m/Y', strtotime($fakeB)), 'text');
    }
    if ($u->about_me) {
        $add($u->about_me, 'ข้อมูลแนะนำตัวสำหรับเวอร์ชันทดลอง', 'text');
    }
    $info = is_array($u->data_info) ? $u->data_info : [];
    foreach (['firstname' => 'first', 'lastname' => 'last'] as $k => $which) {
        if (! empty($info[$k]) && is_string($info[$k])) {
            $add($info[$k], $which === 'first' ? $fFirst : $fLast, 'name');
        }
    }
    if (! empty($info['contact_number']) && is_string($info['contact_number'])) {
        $add($info['contact_number'], $fakeDigits($info['contact_number'], $seed), 'phone');
    }
    if (! empty($info['id_card']) && is_string($info['id_card'])) {
        $add($info['id_card'], $fakeId($info['id_card'], $seed), 'id');
    }
    if (! empty($info['line']) && is_string($info['line'])) {
        $add($info['line'], 'line_demo' . $u->id, 'text');
    }
    $addrJson = $row->data_address ? json_decode($row->data_address, true) : null;
    foreach ([$info['address'] ?? null, is_array($addrJson) ? ($addrJson['address'] ?? null) : null] as $a) {
        if (is_string($a) && trim($a) !== '') {
            $add($a, (10 + $h('a' . $seed, 80)) . '/' . (1 + $h('b' . $seed, 9)) . ' ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310', 'address');
        }
    }
    if ($u->avatar_path) {
        $avatars[] = (string) $u->avatar_path;
    }
}

// ---- ผู้จองเข้าชม / ผู้ลงทะเบียนกิจกรรม (กรอกเอง ไม่มีบัญชีก็ได้)
foreach (['bookings', 'booking_event_registrations'] as $t) {
    if (! Schema::hasTable($t)) {
        continue;
    }
    foreach (DB::table($t)->get() as $row) {
        $seed = $t . $row->id;
        $name = trim((string) ($row->name ?? ''));
        $parts = preg_split('/\s+/u', $name, 2);
        [$fFirst, $fLast, $enFirst, $enLast] = $personName($parts[0] ?? '', $parts[1] ?? '', $seed);
        if ($name !== '') {
            $add($name, $fFirst . ' ' . $fLast, 'name');
        }
        if (! empty($row->email)) {
            $add($row->email, $fakeEmail($row->email, $enFirst, $enLast, $seed), 'email');
        }
        if (! empty($row->phone)) {
            $add($row->phone, $fakeDigits($row->phone, $seed), 'phone');
        }
    }
}

// ---- อีเมลใน log ที่ไม่ใช่ผู้ใช้ในระบบ (ผู้รับอีเมล, ผู้ติดต่องาน, ขอรีเซ็ตรหัสผ่าน)
$extra = [];
foreach ([['log_mails', 'email_to'], ['forms_assignment', 'contact_email'], ['password_resets', 'email'], ['logs', 'email'], ['login_histories', 'email']] as [$t, $c]) {
    if (Schema::hasTable($t) && Schema::hasColumn($t, $c)) {
        foreach (DB::table($t)->whereNotNull($c)->distinct()->pluck($c) as $e) {
            foreach (preg_split('/[,;\s]+/', (string) $e) as $one) {
                if (str_contains($one, '@')) {
                    $extra[] = $one;
                }
            }
        }
    }
}

// ---- อีเมล/เบอร์ขององค์กร (ไม่ใช่ข้อมูลส่วนบุคคล) ไม่ต้องแทน
foreach (['user_orgs' => ['contact_email', 'phone', 'phone1', 'phone2', 'phone3', 'phone4', 'phone5'], 'publishers' => ['contact_email']] as $t => $cols) {
    if (! Schema::hasTable($t)) {
        continue;
    }
    foreach (DB::table($t)->get() as $row) {
        foreach ($cols as $c) {
            if (! empty($row->$c)) {
                $allow[] = (string) $row->$c;
            }
        }
    }
}
$allow[] = (string) config('mail.from.address');
$allow = array_values(array_unique(array_filter($allow)));

foreach (array_unique($extra) as $i => $e) {
    if (! in_array($e, $allow, true)) {
        $add($e, 'contact' . ($i + 1) . '@example.com', 'email');
    }
}

// ---- ค่าที่ระบบปิดบังแล้ว (ตาราง/รายงาน) → ค่าปิดบังของค่าสมมติ
$masked = [];
foreach ($pairs as $real => $fake) {
    $type = $types[$real];
    if (! in_array($type, ['email', 'phone', 'id', 'name', 'address'], true)) {
        continue;
    }
    $mr = Pii::mask($real, $type);
    $mf = Pii::mask($fake, $type);
    if ($mr !== $real && ! isset($pairs[$mr]) && ! isset($masked[$mr])) {
        $masked[$mr] = $mf;
    }
}

file_put_contents($outFile, json_encode([
    'pairs' => $pairs,
    'masked' => $masked,
    'types' => $types,
    'avatars' => array_values(array_unique($avatars)),
    'allow' => $allow,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo 'pairs ' . count($pairs) . ', masked ' . count($masked) . ', avatars ' . count($avatars) . ', allow ' . count($allow) . "\n";
