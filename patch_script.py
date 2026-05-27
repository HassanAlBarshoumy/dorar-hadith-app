import sys
import re

content = open('script.js', 'r', encoding='utf-8').read()

content = content.replace(
    '} else if (window.pywebview && window.pywebview.api && window.pywebview.api.get_settings) {',
    '} else if (window.electronAPI && window.electronAPI.getSettings) {\n                settingsStr = await window.electronAPI.getSettings();\n            } else if (window.pywebview && window.pywebview.api && window.pywebview.api.get_settings) {'
)

content = content.replace(
    '} else if (window.pywebview && window.pywebview.api && window.pywebview.api.save_settings) {',
    '} else if (window.electronAPI && window.electronAPI.saveSettings) {\n            window.electronAPI.saveSettings(JSON.stringify(appSettings));\n        } else if (window.pywebview && window.pywebview.api && window.pywebview.api.save_settings) {'
)

content = content.replace(
    'if (window.pywebview && window.pywebview.api && window.pywebview.api.search_local_hadith) {',
    'if (window.electronAPI && window.electronAPI.searchLocalDb) {\n                    const localDataStr = await window.electronAPI.searchLocalDb(query);\n                    localData = JSON.parse(localDataStr);\n                } else if (window.pywebview && window.pywebview.api && window.pywebview.api.search_local_hadith) {'
)

# First search (in Dorar search)
content = content.replace(
    'if (window.pywebview && window.pywebview.api && window.pywebview.api.search) {',
    'if (window.electronAPI && window.electronAPI.fetchDorar) {\n                        const rawResponse = await window.electronAPI.fetchDorar(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}`);\n                        dorarData = JSON.parse(rawResponse);\n                    } else if (window.pywebview && window.pywebview.api && window.pywebview.api.search) {',
    1
)

# Second search (in book specific search, uses keyword)
content = content.replace(
    'if (window.pywebview && window.pywebview.api && window.pywebview.api.search) {',
    'if (window.electronAPI && window.electronAPI.fetchDorar) {\n                        const rawResponse = await window.electronAPI.fetchDorar(`https://dorar.net/dorar_api.json?skey=${encodeURIComponent(keyword)}`);\n                        dorarData = JSON.parse(rawResponse);\n                    } else if (window.pywebview && window.pywebview.api && window.pywebview.api.search) {',
    1
)

content = content.replace(
    'if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {',
    'if (window.electronAPI && window.electronAPI.logError) {\n                window.electronAPI.logError(err.toString() + " | Stack: " + (err.stack || "No stack"));\n            } else if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {'
)

# Window error handler
content = content.replace(
    'if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {',
    'if (window.electronAPI && window.electronAPI.logError) {\n            window.electronAPI.logError(`Error: ${event.message} at ${event.filename}:${event.lineno}`);\n        } else if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {',
    1
)

# Unhandled rejection
content = content.replace(
    'if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {',
    'if (window.electronAPI && window.electronAPI.logError) {\n            window.electronAPI.logError(`Unhandled Promise Rejection: ${event.reason}`);\n        } else if (window.pywebview && window.pywebview.api && window.pywebview.api.log_error) {',
    1
)

open('script.js', 'w', encoding='utf-8').write(content)
