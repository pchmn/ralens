package com.ralens.permissions

import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.app.ActivityCompat
import androidx.core.content.PermissionChecker
import androidx.core.os.bundleOf
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PermissionsModule() : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext)
  private val hasRespondedSharedPreferences
    get() = context.getSharedPreferences("android-permissions.module.asked", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("AndroidPermissions")



    AsyncFunction("checkPermission") { permission: String, promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        checkPermissionApi23(permission, promise, false)
      } else {
        promise.resolve(
          checkPermission(permission)
        )
      }
    }

    AsyncFunction("requestPermission") { permission: String, promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        requestPermissionApi23(permission, promise)
      } else {
        promise.resolve(
          checkPermission(permission)
        )
      }
    }
  }

  private fun checkPermission(permission: String) {
    val granted = PermissionChecker.checkSelfPermission(context, permission) == PermissionChecker.PERMISSION_GRANTED
    bundleOf(
      PermissionsResponse.CAN_ASK_AGAIN_KEY to false,
      PermissionsResponse.GRANTED_KEY to granted,
    )
  }

  @RequiresApi(Build.VERSION_CODES.M)
  private fun checkPermissionApi23(permission: String, promise: Promise, fromRequest: Boolean) {
    val permissionManager = appContext.legacyModuleRegistry.getModule(Permissions::class.java)

    permissionManager.getPermissions(
      { permissionsMap: Map<String, PermissionsResponse> ->

        val areAllGranted = permissionsMap.all { (_, response) -> response.status == PermissionsStatus.GRANTED }
        val areAllDenied = permissionsMap.all { (_, response) -> response.status == PermissionsStatus.DENIED }
        var canAskAgain = !hasRespondedAtLeastOnce(permission) || (areAllDenied && shouldShowRequestPermissionRationale(permission))

        if (fromRequest) {
          // It's a dismiss for the first request
          if (!hasRespondedAtLeastOnce(permission) && areAllDenied && !shouldShowRequestPermissionRationale(permission)) {
            canAskAgain = true
          } else {
            hasRespondedSharedPreferences.edit().putBoolean(permission, true).apply()
          }
        }

        promise.resolve(
          bundleOf(
            PermissionsResponse.CAN_ASK_AGAIN_KEY to canAskAgain,
            PermissionsResponse.GRANTED_KEY to areAllGranted,
            "shouldShowRequestPermissionRationale" to shouldShowRequestPermissionRationale(permission)
          )
        )
      },
      permission
    )
  }

  @RequiresApi(Build.VERSION_CODES.M)
  private fun requestPermissionApi23(permission: String, promise: Promise) {
    val permissionManager = appContext.legacyModuleRegistry.getModule(Permissions::class.java)

    permissionManager.askForPermissions(
      {
        checkPermissionApi23(permission, promise, true)
      },
      permission
    )
  }

  private fun shouldShowRequestPermissionRationale(permission: String): Boolean {
    return ActivityCompat.shouldShowRequestPermissionRationale(requireNotNull(appContext.currentActivity), permission)
  }

  private fun hasRespondedAtLeastOnce(permission: String): Boolean {
    return hasRespondedSharedPreferences.getBoolean(permission, false);
  }

  private fun canAsk(permission: String) {

  }
}
