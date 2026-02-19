<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     * Cart API routes use X-CSRF-TOKEN header from the meta tag instead.
     */
    protected $except = [
        //
    ];
}
