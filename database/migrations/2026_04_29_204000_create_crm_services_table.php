<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_services', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['name', 'deleted_at']);
        });

        DB::table('crm_services')->insert([
            ['name' => 'Recycle', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Data wipe', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Physical Destruction', 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Buyback', 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_services');
    }
};

