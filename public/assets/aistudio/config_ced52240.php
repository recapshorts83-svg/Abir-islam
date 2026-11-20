<?php
/**
 * Viral Video Pro — মূল কনফিগারেশন
 * -------------------------------------------------
 * হোস্টিং-এ আপলোড করার পর শুধু এই ফাইলের ডেটাবেস তথ্যগুলো
 * আপনার cPanel-এর MySQL তথ্য দিয়ে বদলে নিন।
 */

return [
    'db' => [
        // 'mysql'  = আসল হোস্টিং (cPanel / VPS)
        // 'sqlite' = শুধু নিজের কম্পিউটারে টেস্ট করার জন্য
        'driver'      => 'mysql',
        'host'        => 'localhost',
        'port'        => 3306,
        'name'        => 'viralvideo_pro',
        'user'        => 'root',
        'pass'        => '',
        'sqlite_path' => __DIR__ . '/storage/app.sqlite',
    ],

    'app' => [
        'name'     => 'Viral Video Pro',
        'timezone' => 'Asia/Dhaka',
        // লাইভ সাইটে সবসময় false রাখুন
        'debug'    => false,
    ],
];
