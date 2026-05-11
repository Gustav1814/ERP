<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('email', 150)->nullable()->index();
            $table->string('phone', 50)->nullable()->index();
            $table->string('role', 100)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'is_primary']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_users');
    }
};
