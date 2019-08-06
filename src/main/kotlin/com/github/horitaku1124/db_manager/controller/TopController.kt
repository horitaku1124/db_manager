package com.github.horitaku1124.db_manager.controller

import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class TopController {
  @RequestMapping("/")
  fun index() :String{
    return "Top of DB manager";
  }
}