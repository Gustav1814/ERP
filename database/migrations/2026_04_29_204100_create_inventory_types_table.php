<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->decimal('default_weight_lbs', 8, 2)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['name', 'deleted_at']);
        });

        DB::table('inventory_types')->insert([
            ['name' => 'Dimensions', 'default_weight_lbs' => null, 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Laptop', 'default_weight_lbs' => 5, 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Desktop', 'default_weight_lbs' => null, 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Networking', 'default_weight_lbs' => null, 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Servers', 'default_weight_lbs' => null, 'sort_order' => 5, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'HDD/SSD', 'default_weight_lbs' => null, 'sort_order' => 6, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'IP Phone', 'default_weight_lbs' => null, 'sort_order' => 7, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Cell Phone', 'default_weight_lbs' => null, 'sort_order' => 8, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Other IT Equipment', 'default_weight_lbs' => null, 'sort_order' => 9, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_types');
    }
};

