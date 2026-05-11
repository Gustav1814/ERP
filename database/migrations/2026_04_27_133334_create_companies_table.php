<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('primary_contact_name', 150)->nullable();
            $table->string('project_manager', 150)->nullable();
            $table->string('primary_email', 150)->nullable()->index();
            $table->string('primary_phone', 50)->nullable()->index();
            $table->string('customer_type', 50)->nullable();
            $table->string('lead_channel', 50)->nullable();
            $table->string('hear_about_us', 100)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
