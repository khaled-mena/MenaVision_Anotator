package workforce_policy

import rego.v1

import data.utils

# input: {
#     "scope": <"view"|"update"> or null,
#     "auth": {
#         "user": {
#             "id": <num>,
#             "privilege": <"admin"|"user"|"worker"> or null
#         },
#         "organization": null
#     },
#     "resource": null
# }

default allow := false

allow if {
    utils.is_admin
}

allow if {
    input.scope == utils.VIEW
}
