package workforce

import rego.v1

import data.utils

# input: {
#     "scope": <"list"|"view"|"create"|"update"|"delete"> or null,
#     "auth": {
#         "user": {
#             "id": <num>,
#             "privilege": <"admin"|"user"|"worker"> or null
#         },
#         "organization": null
#     },
#     "resource": {
#         "id": <num>
#     } or null
# }

default allow := false

allow if {
    utils.is_admin
}

filter := {} if {
    utils.is_admin
} else := {"id": null}
